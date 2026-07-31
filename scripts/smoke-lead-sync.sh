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
export PORT=18080

"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:18080/api/v1/health" >/dev/null; then
    break
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18080/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:18080/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18080/api/v1/workflows/demo.lead-sync/runs" \
  -H 'content-type: application/json' \
  -d '{"params":{"lead_id":"L-123"}}')
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18080/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "WAITING_APPROVAL" ]]; then
    break
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed early: $STATUS" >&2
    curl -sf "http://127.0.0.1:18080/api/v1/runs/$RUN_ID" >&2
    exit 1
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18080/api/v1/runs/$RUN_ID/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"script"}' >/dev/null

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18080/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "COMPLETED" ]]; then
    echo "OK run=$RUN_ID status=$STATUS"
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed: $STATUS" >&2
    curl -sf "http://127.0.0.1:18080/api/v1/runs/$RUN_ID" >&2
    exit 1
  fi
  sleep 0.1
done

echo "timeout waiting for COMPLETED" >&2
exit 1
