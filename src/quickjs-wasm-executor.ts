import { normalizeCode, sanitizeToolName, type Executor } from "@cloudflare/codemode";
import { getQuickJSWASMModule } from "@cf-wasm/quickjs/workerd";
import * as Sentry from "@sentry/cloudflare";

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
    return Sentry.startSpan(
      {
        name: "quickjs.execute",
        op: "codemode.executor",
        attributes: {
          "codemode.executor": "quickjs-wasm",
          "codemode.timeout_ms": this.#timeout,
        },
      },
      async (span) => {
        const providers = this.#normalizeProviders(providersOrFns);
        const normalizedCode = normalizeCode(code);
        span?.setAttribute("codemode.provider_count", providers.length);

        const quickjs = await Sentry.startSpan(
          { name: "quickjs.load_module", op: "codemode.executor.init" },
          () => getQuickJSWASMModule(),
        );
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
              const __stringifyError = (error) => {
                if (error instanceof Error) {
                  return error.message;
                }
                if (typeof error === "string") {
                  return error;
                }
                if (error && typeof error === "object") {
                  try {
                    return JSON.stringify(error);
                  } catch {
                    return Object.prototype.toString.call(error);
                  }
                }
                return String(error);
              };
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
                  error: __stringifyError(error),
                  logs: __logs,
                });
              }
            })()
          `;

          const evalResult = Sentry.startSpan(
            { name: "quickjs.eval", op: "codemode.executor.eval" },
            () => vm.evalCode(runtimeCode, "executor.js"),
          );
          if (evalResult.error) {
            const error = String(vm.dump(evalResult.error).toString());
            evalResult.error.dispose();
            captureExecutorMessage("quickjs.eval_error", error);

            return { result: undefined, error };
          }

          drainHostQueue = vm.getProp(vm.global, "__drainHostQueue");
          resolveHostCall = vm.getProp(vm.global, "__resolveHostCall");

          let promiseState = vm.getPromiseState(evalResult.value);
          const deadline = Date.now() + this.#timeout;
          while (promiseState.type === "pending" && Date.now() < deadline) {
            const drainResult = vm.callFunction(drainHostQueue, vm.undefined);
            if (drainResult.error) {
              const error = String(vm.dump(drainResult.error).toString());
              drainResult.error.dispose();
              evalResult.value.dispose();
              captureExecutorMessage("quickjs.host_queue_drain_error", error);
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
            span?.setAttribute("codemode.host_call.batch_size", queuedCalls.length);

            for (const queuedCall of queuedCalls) {
              const response = await this.#executeHostCall(providers, queuedCall);

              const idHandle = vm.newNumber(queuedCall.id);
              const payloadHandle = vm.newString(JSON.stringify(response));
              const settleResult = vm.callFunction(resolveHostCall, vm.undefined, idHandle, payloadHandle);
              idHandle.dispose();
              payloadHandle.dispose();

              if (settleResult.error) {
                const error = String(vm.dump(settleResult.error).toString());
                settleResult.error.dispose();
                evalResult.value.dispose();
                captureExecutorMessage("quickjs.host_call_settle_error", error);
                return { result: undefined, error };
              }

              settleResult.value.dispose();
            }

            const pending = vm.runtime.executePendingJobs();
            if (pending.error) {
              const error = String(vm.dump(pending.error).toString());
              pending.error.dispose();
              evalResult.value.dispose();
              captureExecutorMessage("quickjs.pending_jobs_error", error);
              return { result: undefined, error };
            }
            promiseState = vm.getPromiseState(evalResult.value);
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          if (promiseState.type === "pending") {
            evalResult.value.dispose();
            captureExecutorMessage("quickjs.timeout", "Execution timed out", "warning");
            return { result: undefined, error: "Execution timed out" };
          }

          if (promiseState.type === "rejected") {
            const error = String(vm.dump(promiseState.error).toString());
            promiseState.error.dispose();
            evalResult.value.dispose();
            captureExecutorMessage("quickjs.rejected", error, "warning");
            return { result: undefined, error };
          }

          const payload = vm.dump(promiseState.value);
          promiseState.value.dispose();
          evalResult.value.dispose();
          const parsed = JSON.parse(String(payload)) as ExecuteResult;
          span?.setAttribute("codemode.execution.has_logs", Boolean(parsed.logs?.length));
          span?.setAttribute("codemode.execution.has_error", Boolean(parsed.error));
          return {
            result: parsed.result,
            error: parsed.error,
            logs: parsed.logs,
          };
        } catch (error: unknown) {
          Sentry.captureException(asError(error));
          return {
            result: undefined,
            error: formatUnknownError(error),
          };
        } finally {
          await Sentry.startSpan(
            { name: "quickjs.cleanup", op: "codemode.executor.cleanup" },
            async () => {
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
            },
          );
        }
      },
    );
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

  async #executeHostCall(
    providers: ResolvedProvider[],
    queuedCall: {
      id: number;
      providerName: string;
      toolName: string;
      payload: unknown;
    },
  ): Promise<{ result?: unknown; error?: string }> {
    return Sentry.startSpan(
      {
        name: `${queuedCall.providerName}.${sanitizeToolName(queuedCall.toolName)}`,
        op: "codemode.host_call",
        attributes: {
          "codemode.provider": queuedCall.providerName,
          "codemode.tool": sanitizeToolName(queuedCall.toolName),
        },
      },
      async () => {
        const provider = providers.find((entry) => entry.name === queuedCall.providerName);
        if (!provider) {
          captureExecutorMessage("quickjs.unknown_provider", `Unknown provider: ${queuedCall.providerName}`, "warning");
          return { error: `Unknown provider: ${queuedCall.providerName}` };
        }

        const sanitizedToolName = sanitizeToolName(queuedCall.toolName);
        const fn = provider.fns[sanitizedToolName];
        if (!fn) {
          captureExecutorMessage(
            "quickjs.unknown_tool",
            `Unknown tool: ${queuedCall.providerName}.${queuedCall.toolName}`,
            "warning",
          );
          return { error: `Unknown tool: ${queuedCall.providerName}.${queuedCall.toolName}` };
        }

        try {
          const result = provider.positionalArgs
            ? await fn(...(Array.isArray(queuedCall.payload) ? queuedCall.payload : []))
            : await fn(queuedCall.payload ?? {});
          return { result };
        } catch (error: unknown) {
          Sentry.withScope((scope) => {
            scope.setLevel("warning");
            scope.setContext("quickjs_host_call", {
              provider: queuedCall.providerName,
              tool: sanitizedToolName,
            });
            Sentry.captureException(asError(error));
          });

          return {
            error: formatUnknownError(error),
          };
        }
      },
    );
  }
}

function captureExecutorMessage(
  fingerprint: string,
  message: string,
  level: "warning" | "error" = "error",
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setFingerprint([fingerprint]);
    Sentry.captureMessage(message);
  });
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(formatUnknownError(error));
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}
