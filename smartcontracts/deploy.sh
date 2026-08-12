#!/usr/bin/env bash
set -euo pipefail

CONTRACT_DIR=contracts/payment_registry
pushd smartcontracts/\$CONTRACT_DIR

# Build for WASM
cargo build --target wasm32-unknown-unknown --release

# Path to wasm
WASM=target/wasm32-unknown-unknown/release/payment_registry.wasm

if [ ! -f "\$WASM" ]; then
  echo "WASM not found at \$WASM"
  exit 1
fi

# Deploy using soroban-cli (requires soroban-cli installed and configured)
# Set environment variables before running:
# export SOROBAN_SOURCE="<your-secret-key>"
# export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
# Example:
# SOROBAN_SOURCE and SOROBAN_RPC_URL should be set in your environment
soroban contract deploy --wasm \$WASM --source "\$SOROBAN_SOURCE" --rpc-url "\$SOROBAN_RPC_URL"

popd
