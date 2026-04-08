declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "*.wasm.map.txt" {
  const wasmSourceMapData: string;
  export default wasmSourceMapData;
}
