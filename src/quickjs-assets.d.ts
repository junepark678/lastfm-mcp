declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "*.wasm.map.txt" {
  const wasmSourceMapData: string;
  export default wasmSourceMapData;
}

declare module "*.emscripten.browser.mjs" {
  const emscriptenModuleLoader: (options?: unknown) => Promise<unknown>;
  export default emscriptenModuleLoader;
}
