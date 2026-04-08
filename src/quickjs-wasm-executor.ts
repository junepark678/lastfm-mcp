import { normalizeCode, sanitizeToolName, type Executor } from "@cloudflare/codemode";
import { RELEASE_SYNC as baseVariant, newQuickJSWASMModule } from "quickjs-emscripten";
import { newVariant } from "quickjs-emscripten-core";
import wasmModule from "./RELEASE_SYNC.wasm";
import browserModuleLoader from "./RELEASE_SYNC.emscripten.browser.mjs";

type ExecuteResult = Awaited<ReturnType<Executor["execute"]>>;
type ProviderArg = Parameters<Executor["execute"]>[1];

type ResolvedProvider = {
  name: string;
  fns: Record<string, (...args: unknown[]) => Promise<unknown>>;
  positionalArgs?: boolean;
};

const workerdSafeBaseVariant: typeof baseVariant = {
  ...baseVariant,
  importModuleLoader: async () => {
    const globalWithProcess = globalThis as typeof globalThis & { process?: unknown };
    const baseModuleLoader = browserModuleLoader;

    return (async (moduleArg?: unknown) => {
      const hadOwnProcess = Object.prototype.hasOwnProperty.call(globalWithProcess, "process");
      const originalProcess = globalWithProcess.process;

      try {
        if (hadOwnProcess) {
          delete globalWithProcess.process;
        }
        return await baseModuleLoader(moduleArg);
      } finally {
        if (hadOwnProcess) {
          globalWithProcess.process = originalProcess;
        }
      }
    }) as Awaited<ReturnType<typeof baseVariant.importModuleLoader>>;
  },
};

const cloudflareVariant = newVariant(workerdSafeBaseVariant, {
  wasmModule,
});

export class QuickJsWasmExecutor implements Executor {
  #timeout: number;

  constructor(options?: { timeout?: number }) {
    this.#timeout = options?.timeout ?? 30_000;
  }

  async execute(code: string, providersOrFns: ProviderArg): Promise<ExecuteResult> {
    const providers = this.#normalizeProviders(providersOrFns);
    const normalizedCode = normalizeCode(code);
    const quickjs = await newQuickJSWASMModule(cloudflareVariant);
    const vm = quickjs.newContext();
    const hostTasks = new Set<Promise<void>>();

    try {
      const hostCall = vm.newFunction("__hostCall", (...rawArgs) => {
        const [providerHandle, toolHandle, payloadHandle] = rawArgs;
        const providerName = providerHandle ? String(vm.dump(providerHandle)) : "";
        const toolName = toolHandle ? String(vm.dump(toolHandle)) : "";
        const payload = payloadHandle ? vm.dump(payloadHandle) : undefined;

        const provider = providers.find((entry) => entry.name === providerName);
        if (!provider) {
          return vm.newString(JSON.stringify({ error: `Unknown provider: ${providerName}` }));
        }

        const fn = provider.fns[sanitizeToolName(toolName)];
        if (!fn) {
          return vm.newString(JSON.stringify({ error: `Unknown tool: ${providerName}.${toolName}` }));
        }

        const deferred = vm.newPromise();
        const task = (async () => {
          try {
            const result = provider.positionalArgs ? await fn(...(Array.isArray(payload) ? payload : [])) : await fn(payload ?? {});
            const response = vm.newString(JSON.stringify({ result }));
            deferred.resolve(response);
            response.dispose();
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const response = vm.newString(JSON.stringify({ error: message }));
            deferred.resolve(response);
            response.dispose();
          } finally {
            deferred.dispose();
          }
        })();
        hostTasks.add(task);
        task.finally(() => hostTasks.delete(task));

        return deferred.handle;
      });

      vm.setProp(vm.global, "__hostCall", hostCall);
      hostCall.dispose();

      const providerConfigJson = JSON.stringify(providers.map((provider) => ({
        name: provider.name,
        positionalArgs: provider.positionalArgs ?? false,
      })));

      const runtimeCode = `
        (async () => {
          const __logs = [];
          globalThis.console = {
            log: (...a) => __logs.push(a.map(String).join(" ")),
            warn: (...a) => __logs.push("[warn] " + a.map(String).join(" ")),
            error: (...a) => __logs.push("[error] " + a.map(String).join(" ")),
          };

          const __providerConfig = ${providerConfigJson};
          for (const provider of __providerConfig) {
            globalThis[provider.name] = new Proxy({}, {
              get: (_, toolName) => {
                if (provider.positionalArgs) {
                  return async (...args) => {
                    const res = JSON.parse(await __hostCall(provider.name, String(toolName), args));
                    if (res.error) throw new Error(res.error);
                    return res.result;
                  };
                }

                return async (args = {}) => {
                  const res = JSON.parse(await __hostCall(provider.name, String(toolName), args));
                  if (res.error) throw new Error(res.error);
                  return res.result;
                };
              }
            });
          }

          try {
            const result = await Promise.race([
              (${normalizedCode})(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out")), ${this.#timeout})),
            ]);
            return JSON.stringify({ result, logs: __logs });
          } catch (error) {
            return JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              logs: __logs,
            });
          }
        })();
      `;

      const evalResult = vm.evalCode(runtimeCode, "executor.js");
      if (evalResult.error) {
        const error = String(vm.dump(evalResult.error));
        evalResult.error.dispose();
        return { result: undefined, error };
      }

      let resolved: Awaited<ReturnType<typeof vm.resolvePromise>> | undefined;
      let resolveError: unknown;
      vm.resolvePromise(evalResult.value)
        .then((value) => { resolved = value; })
        .catch((error: unknown) => { resolveError = error; });

      const deadline = Date.now() + this.#timeout;
      while (!resolved && !resolveError && Date.now() < deadline) {
        const pending = vm.runtime.executePendingJobs();
        if (pending.error) {
          const error = String(vm.dump(pending.error));
          pending.error.dispose();
          evalResult.value.dispose();
          return { result: undefined, error };
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      evalResult.value.dispose();

      if (resolveError) {
        return {
          result: undefined,
          error: resolveError instanceof Error ? resolveError.message : String(resolveError),
        };
      }
      if (!resolved) {
        return { result: undefined, error: "Execution timed out" };
      }

      if (resolved.error) {
        const error = String(vm.dump(resolved.error));
        resolved.error.dispose();
        return { result: undefined, error };
      }

      const payload = vm.dump(resolved.value);
      resolved.value.dispose();
      const parsed = JSON.parse(String(payload)) as ExecuteResult;
      return {
        result: parsed.result,
        error: parsed.error,
        logs: parsed.logs,
      };
    } catch (error: unknown) {
      return {
        result: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (hostTasks.size > 0) {
        await Promise.allSettled([...hostTasks]);
      }
      for (let i = 0; i < 5; i += 1) {
        const pending = vm.runtime.executePendingJobs();
        if (pending.error) {
          pending.error.dispose();
          break;
        }
        if ((pending.value ?? 0) === 0) {
          break;
        }
      }
      vm.dispose();
    }
  }

  #normalizeProviders(providersOrFns: ProviderArg): ResolvedProvider[] {
    if (Array.isArray(providersOrFns)) {
      return providersOrFns.map((provider) => ({
        ...provider,
        fns: Object.fromEntries(
          Object.entries(provider.fns).map(([name, fn]) => [sanitizeToolName(name), fn]),
        ),
      }));
    }

    return [{
      name: "codemode",
      fns: Object.fromEntries(
        Object.entries(providersOrFns).map(([name, fn]) => [sanitizeToolName(name), fn]),
      ),
      positionalArgs: false,
    }];
  }
}
