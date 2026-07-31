#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$DATA"
}
trap cleanup EXIT

cd "$ROOT/backend"
go build -o "$BIN/demo-crm" ./cmd/demo-crm
go build -o "$BIN/demo-erp" ./cmd/demo-erp
go build -o "$BIN/helios" ./cmd/helios

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.lead-sync.yaml"
export PORT="${PORT:-8080}"

"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null; then
    break
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:${PORT}/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:${PORT}/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

echo "Helios API ready on http://127.0.0.1:${PORT}"
echo "CLIs registered: demo-crm, demo-erp"
echo "Workflow bootstrapped: demo.lead-sync"
echo "Start console: cd web && pnpm dev"
echo "Press Ctrl+C to stop."
wait "$SERVER_PID"
