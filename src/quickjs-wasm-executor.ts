import { normalizeCode, sanitizeToolName, type Executor } from "@cloudflare/codemode";
import { newAsyncContext } from "quickjs-emscripten";

type ExecuteResult = Awaited<ReturnType<Executor["execute"]>>;
type ProviderArg = Parameters<Executor["execute"]>[1];

type ResolvedProvider = {
  name: string;
  fns: Record<string, (...args: unknown[]) => Promise<unknown>>;
  positionalArgs?: boolean;
};

export class QuickJsWasmExecutor implements Executor {
  #timeout: number;

  constructor(options?: { timeout?: number }) {
    this.#timeout = options?.timeout ?? 30_000;
  }

  async execute(code: string, providersOrFns: ProviderArg): Promise<ExecuteResult> {
    const providers = this.#normalizeProviders(providersOrFns);
    const normalizedCode = normalizeCode(code);
    const vm = await newAsyncContext();

    try {
      const hostCall = vm.newAsyncifiedFunction("__hostCall", async (...rawArgs) => {
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

        try {
          const result = provider.positionalArgs ? await fn(...(Array.isArray(payload) ? payload : [])) : await fn(payload ?? {});
          return vm.newString(JSON.stringify({ result }));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return vm.newString(JSON.stringify({ error: message }));
        }
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

      const evalResult = await vm.evalCodeAsync(runtimeCode, "executor.js");
      if (evalResult.error) {
        const error = String(vm.dump(evalResult.error));
        evalResult.error.dispose();
        return { result: undefined, error };
      }

      const resolved = await vm.resolvePromise(evalResult.value);
      evalResult.value.dispose();

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
