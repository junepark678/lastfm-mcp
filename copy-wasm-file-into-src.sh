#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$ROOT_DIR/src"
WASM_PKG_DIR="$ROOT_DIR/node_modules/@jitl/quickjs-wasmfile-debug-sync/dist"

mkdir -p "$SRC_DIR"

cp "$WASM_PKG_DIR/emscripten-module.wasm" "$SRC_DIR/DEBUG_SYNC.wasm"
cp "$WASM_PKG_DIR/emscripten-module.wasm.map" "$SRC_DIR/DEBUG_SYNC.wasm.map.txt"

echo "Copied QuickJS DEBUG_SYNC wasm assets into src/."
