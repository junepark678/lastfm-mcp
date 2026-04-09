import { normalizeCode, sanitizeToolName, type Executor } from "@cloudflare/codemode";
import { getQuickJSWASMModule } from "@cf-wasm/quickjs/workerd";

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
    const quickjs = await getQuickJSWASMModule();
    const vm = quickjs.newContext();
    let drainHostQueue:
      | ReturnType<typeof vm.getProp>
      | undefined;
    let resolveHostCall:
      | ReturnType<typeof vm.getProp>
      | undefined;

    try {
      const providerConfigJson = JSON.stringify(providers.map((provider) => ({
        name: provider.name,
        positionalArgs: provider.positionalArgs ?? false,
      })));
      const providerBindings = providers.map((provider) => (
        `const ${provider.name} = __providers[${JSON.stringify(provider.name)}];`
      )).join("\n");

      const runtimeCode = `
        (async () => {
          "use strict";
          const __logs = [];
          const console = {
            log: (...a) => __logs.push(a.map(String).join(" ")),
            warn: (...a) => __logs.push("[warn] " + a.map(String).join(" ")),
            error: (...a) => __logs.push("[error] " + a.map(String).join(" ")),
          };
          const __hostQueue = [];
          const __pendingHostCalls = new Map();
          let __nextHostCallId = 1;

          globalThis.__drainHostQueue = () => JSON.stringify(__hostQueue.splice(0, __hostQueue.length));
          globalThis.__resolveHostCall = (id, payloadJson) => {
            const pending = __pendingHostCalls.get(id);
            if (!pending) {
              return false;
            }
            __pendingHostCalls.delete(id);
            const payload = JSON.parse(payloadJson);
            if (payload.error) {
              pending.reject(new Error(payload.error));
            } else {
              pending.resolve(payload.result);
            }
            return true;
          };

          const __providerConfig = ${providerConfigJson};
          const __providers = {};
          for (const provider of __providerConfig) {
            __providers[provider.name] = new Proxy({}, {
              get: (_, toolName) => {
                if (provider.positionalArgs) {
                  return async (...args) => {
                    return new Promise((resolve, reject) => {
                      const id = __nextHostCallId++;
                      __pendingHostCalls.set(id, { resolve, reject });
                      __hostQueue.push({
                        id,
                        providerName: provider.name,
                        toolName: String(toolName),
                        payload: args,
                      });
                    });
                  };
                }

                return (args = {}) => new Promise((resolve, reject) => {
                  const id = __nextHostCallId++;
                  __pendingHostCalls.set(id, { resolve, reject });
                  __hostQueue.push({
                    id,
                    providerName: provider.name,
                    toolName: String(toolName),
                    payload: args,
                  });
                };
              }
            });
          }
          ${providerBindings}

          try {
            const result = await (${normalizedCode})();
            return JSON.stringify({ result, logs: __logs });
          } catch (error) {
            return JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              logs: __logs,
            });
          }
        })()
      `;

      const evalResult = vm.evalCode(runtimeCode, "executor.js");
      if (evalResult.error) {
        const error = String(vm.dump(evalResult.error));
        evalResult.error.dispose();
        return { result: undefined, error };
      }

      drainHostQueue = vm.getProp(vm.global, "__drainHostQueue");
      resolveHostCall = vm.getProp(vm.global, "__resolveHostCall");

      let promiseState = vm.getPromiseState(evalResult.value);
      const deadline = Date.now() + this.#timeout;
      while (promiseState.type === "pending" && Date.now() < deadline) {
        const drainResult = vm.callFunction(drainHostQueue, vm.undefined);
        if (drainResult.error) {
          const error = String(vm.dump(drainResult.error));
          drainResult.error.dispose();
          evalResult.value.dispose();
          return { result: undefined, error };
        }

        const queuedJson = String(vm.dump(drainResult.value));
        drainResult.value.dispose();
        const queuedCalls = JSON.parse(queuedJson) as Array<{
          id: number;
          providerName: string;
          toolName: string;
          payload: unknown;
        }>;

        for (const queuedCall of queuedCalls) {
          const provider = providers.find((entry) => entry.name === queuedCall.providerName);
          const response = await (async () => {
            if (!provider) {
              return { error: `Unknown provider: ${queuedCall.providerName}` };
            }

            const fn = provider.fns[sanitizeToolName(queuedCall.toolName)];
            if (!fn) {
              return { error: `Unknown tool: ${queuedCall.providerName}.${queuedCall.toolName}` };
            }

            try {
              const result = provider.positionalArgs
                ? await fn(...(Array.isArray(queuedCall.payload) ? queuedCall.payload : []))
                : await fn(queuedCall.payload ?? {});
              return { result };
            } catch (error: unknown) {
              return {
                error: error instanceof Error ? error.message : String(error),
              };
            }
          })();

          const idHandle = vm.newNumber(queuedCall.id);
          const payloadHandle = vm.newString(JSON.stringify(response));
          const settleResult = vm.callFunction(resolveHostCall, vm.undefined, idHandle, payloadHandle);
          idHandle.dispose();
          payloadHandle.dispose();

          if (settleResult.error) {
            const error = String(vm.dump(settleResult.error));
            settleResult.error.dispose();
            evalResult.value.dispose();
            return { result: undefined, error };
          }

          settleResult.value.dispose();
        }

        const pending = vm.runtime.executePendingJobs();
        if (pending.error) {
          const error = String(vm.dump(pending.error));
          pending.error.dispose();
          evalResult.value.dispose();
          return { result: undefined, error };
        }
        promiseState = vm.getPromiseState(evalResult.value);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      if (promiseState.type === "pending") {
        evalResult.value.dispose();
        return { result: undefined, error: "Execution timed out" };
      }

      if (promiseState.type === "rejected") {
        const error = String(vm.dump(promiseState.error));
        promiseState.error.dispose();
        evalResult.value.dispose();
        return { result: undefined, error };
      }

      const payload = vm.dump(promiseState.value);
      promiseState.value.dispose();
      evalResult.value.dispose();
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
      drainHostQueue?.dispose();
      resolveHostCall?.dispose();
      const cleanupDeadline = Date.now() + 100;
      while (Date.now() < cleanupDeadline) {
        const pending = vm.runtime.executePendingJobs();
        if (pending.error) {
          pending.error.dispose();
          break;
        }
        if ((pending.value ?? 0) === 0) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
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
