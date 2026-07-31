#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HELIOS_GUI_MODE="${HELIOS_GUI_MODE:-playwright}"
export HELIOS_GUI_PORT="${HELIOS_GUI_PORT:-8792}"
cd "$ROOT/packages/gui-operator"
if [[ ! -d node_modules/playwright ]]; then
  npm install
fi
if [[ "$HELIOS_GUI_MODE" == "playwright" ]]; then
  npx playwright install chromium >/dev/null
fi
exec node src/server.js
