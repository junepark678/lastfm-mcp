#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$ROOT_DIR/src"
WASM_PKG_DIR="$ROOT_DIR/node_modules/@jitl/quickjs-wasmfile-release-sync/dist"

mkdir -p "$SRC_DIR"

cp "$WASM_PKG_DIR/emscripten-module.wasm" "$SRC_DIR/RELEASE_SYNC.wasm"
cp "$WASM_PKG_DIR/emscripten-module.browser.mjs" "$SRC_DIR/RELEASE_SYNC.emscripten.browser.mjs"

echo "Copied QuickJS RELEASE_SYNC wasm assets into src/."
