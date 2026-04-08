import { normalizeCode, sanitizeToolName, type ExecuteResult, type Executor, type ResolvedProvider } from "@cloudflare/codemode";
import { QuickJS } from "quickjs-wasi";

const QUICKJS_WASM_URL = "https://unpkg.com/quickjs-wasi@2.2.0/quickjs.wasm";
let quickJsWasmPromise: Promise<ArrayBuffer> | undefined;

async function loadQuickJsWasm(): Promise<ArrayBuffer> {
  if (!quickJsWasmPromise) {
    quickJsWasmPromise = fetch(QUICKJS_WASM_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to download quickjs.wasm: HTTP ${response.status}`);
      }

      return await response.arrayBuffer();
    });
  }

  return await quickJsWasmPromise;
}

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

    const vm = await QuickJS.create({ wasm: await loadQuickJsWasm() });

    try {
      const callTool = vm.newFunction("__callTool", function (this: unknown, providerName, toolName, argsJson) {
        const deferred = vm.newPromise();

        Promise.resolve()
          .then(async () => {
            const providerNameValue = String(vm.dump(providerName));
            const toolNameValue = String(vm.dump(toolName));
            const argsJsonValue = String(vm.dump(argsJson));

            const provider = providerFns.get(providerNameValue);
            if (!provider) {
              throw new Error(`Provider \"${providerNameValue}\" not found`);
            }

            const tool = provider[toolNameValue];
            if (!tool) {
              throw new Error(`Tool \"${toolNameValue}\" not found in provider \"${providerNameValue}\"`);
            }

            const parsed = JSON.parse(argsJsonValue) as unknown[] | Record<string, unknown>;
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
