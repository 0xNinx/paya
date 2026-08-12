#!/usr/bin/env bash
set -euo pipefail

# Build contract
cargo build --manifest-path smartcontracts/contracts/payment_registry/Cargo.toml --target wasm32-unknown-unknown --release

# Build frontend
cd frontend
npm install --legacy-peer-deps
npm run build

echo "Built contract and frontend. For contract deploy, set SOROBAN_SOURCE and SOROBAN_RPC_URL and run smartcontracts/deploy.sh"
