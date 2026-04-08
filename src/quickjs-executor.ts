import { normalizeCode, sanitizeToolName, type ExecuteResult, type Executor, type ResolvedProvider } from "@cloudflare/codemode";
import { QuickJS } from "quickjs-wasi";

export class QuickJsWasmExecutor implements Executor {
  async execute(
    code: string,
    providersOrFns: ResolvedProvider[] | Record<string, (...args: unknown[]) => Promise<unknown>>,
  ): Promise<ExecuteResult> {
    const providers = Array.isArray(providersOrFns)
      ? providersOrFns
      : [{ name: "codemode", fns: providersOrFns }];

    const providerFns = new Map<string, Record<string, (...args: unknown[]) => Promise<unknown>>>();
    for (const provider of providers) {
      const sanitizedFns: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
      for (const [name, fn] of Object.entries(provider.fns)) {
        sanitizedFns[sanitizeToolName(name)] = fn;
      }
      providerFns.set(provider.name, sanitizedFns);
    }

    const vm = await QuickJS.create();

    try {
      const callTool = vm.newFunction("__callTool", (_this, providerName, toolName, argsJson) => {
        const deferred = vm.newPromise();

        Promise.resolve()
          .then(async () => {
            const provider = providerFns.get(providerName.toString());
            if (!provider) {
              throw new Error(`Provider \"${providerName.toString()}\" not found`);
            }

            const tool = provider[toolName.toString()];
            if (!tool) {
              throw new Error(`Tool \"${toolName.toString()}\" not found in provider \"${providerName.toString()}\"`);
            }

            const parsed = JSON.parse(argsJson.toString()) as unknown[] | Record<string, unknown>;
            const result = Array.isArray(parsed)
              ? await tool(...parsed)
              : await tool(parsed);

            const resultHandle = vm.hostToHandle(result);
            deferred.resolve(resultHandle);
            resultHandle.dispose();
            vm.executePendingJobs();
          })
          .catch((error: unknown) => {
            const errorHandle = vm.newError(error instanceof Error ? error : new Error(String(error)));
            deferred.reject(errorHandle);
            errorHandle.dispose();
            vm.executePendingJobs();
          });

        return deferred.handle;
      });

      vm.setProp(vm.global, "__callTool", callTool);
      callTool.dispose();

      for (const provider of providers) {
        const methods = Object.keys(provider.fns)
          .map((name) => {
            const safeName = sanitizeToolName(name);
            if (provider.positionalArgs) {
              return `${safeName}: (...args) => __callTool(${JSON.stringify(provider.name)}, ${JSON.stringify(safeName)}, JSON.stringify(args))`;
            }

            return `${safeName}: (args) => __callTool(${JSON.stringify(provider.name)}, ${JSON.stringify(safeName)}, JSON.stringify(args ?? {}))`;
          })
          .join(",\n");

        vm.evalCode(`globalThis.${provider.name} = {\n${methods}\n};`);
      }

      vm.evalCode(`globalThis.__codemodeResult = (${normalizeCode(code)})();`);
      const promiseHandle = vm.evalCode("globalThis.__codemodeResult");

      try {
        const settled = await vm.resolvePromise(promiseHandle);
        if ("error" in settled) {
          return { result: undefined, error: String(vm.dump(settled.error)) };
        }

        return { result: vm.dump(settled.value) };
      } finally {
        promiseHandle.dispose();
      }
    } catch (error) {
      return {
        result: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      vm.dispose();
    }
  }
}
