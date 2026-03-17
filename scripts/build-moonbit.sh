#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p static/moonbit

cd moonbit
moon build --target wasm --release

WASM=_build/wasm/release/build/cmd/web/web.wasm
cp "$WASM" ../static/moonbit/cmd_web.wasm
echo "Copied $WASM → static/moonbit/cmd_web.wasm"
