#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HELIOS_DATA_DIR:-$HOME/.helios}"
PORT="${PORT:-8080}"
BIN_DIR="${HELIOS_BIN_DIR:-$DATA_DIR/bin}"
mkdir -p "$BIN_DIR"

if [[ -z "${HELIOS_OPENCLI_BIN:-}" ]] && ! command -v opencli >/dev/null 2>&1; then
  echo "opencli not found. Install first:"
  echo "  npm i -g @jackwener/opencli"
  echo "or set HELIOS_OPENCLI_BIN to the opencli binary / shim."
  exit 1
fi

echo "Building helios-opencli wrapper..."
(
  cd "$ROOT/backend"
  go build -o "$BIN_DIR/helios-opencli" ./cmd/helios-opencli
)

echo "Registering helios-opencli at $BIN_DIR/helios-opencli"
curl -sf -X POST "http://127.0.0.1:${PORT}/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-opencli\",\"path\":\"$BIN_DIR/helios-opencli\"}"

echo
echo "Bootstrapping OpenCLI workflows..."
for wf in opencli.demo-read.yaml opencli.bilibili-hot.yaml; do
  curl -sf -X PUT "http://127.0.0.1:${PORT}/api/v1/workflows/${wf%.yaml}" \
    -H 'content-type: application/yaml' \
    --data-binary @"$ROOT/workflows/$wf" >/dev/null
  echo "  saved ${wf%.yaml}"
done

echo
echo "Next:"
echo "  - opencli.demo-read     (HN public, no Chrome)"
echo "  - opencli.bilibili-hot  (needs OpenCLI Browser Bridge)"
echo "Docs: docs/opencli.md | Slice P/Q designs under docs/architecture/"
