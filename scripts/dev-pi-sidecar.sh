#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HELIOS_PI_MODE="${HELIOS_PI_MODE:-mock}"
export HELIOS_PI_PORT="${HELIOS_PI_PORT:-8091}"
cd "$ROOT/packages/pi-sidecar"
if [[ ! -d node_modules/@earendil-works/pi-coding-agent ]]; then
  npm install
fi
exec node src/server.js
