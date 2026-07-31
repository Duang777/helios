#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer live credentials when present; do not force mock (Slice J).
# Explicit HELIOS_PI_MODE always wins. Offline: HELIOS_PI_MODE=mock ./scripts/dev-pi-sidecar.sh
LIVE_ENV="$ROOT/.helios-dev/pi-live.env"
if [[ -z "${HELIOS_PI_MODE:-}" && -f "$LIVE_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$LIVE_ENV"
fi

export HELIOS_PI_PORT="${HELIOS_PI_PORT:-8091}"
cd "$ROOT/packages/pi-sidecar"
if [[ ! -d node_modules/@earendil-works/pi-coding-agent ]]; then
  npm install
fi
exec node src/server.js
