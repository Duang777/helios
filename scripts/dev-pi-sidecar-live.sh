#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/.helios-dev/pi-live.env"
export HELIOS_PI_API_KEY="${HELIOS_PI_API_KEY:-${CFMAX_API_KEY}}"
cd "$ROOT/packages/pi-sidecar"
if [[ ! -d node_modules/@earendil-works/pi-coding-agent ]]; then
  npm install
fi
exec /usr/bin/env node src/server.js
