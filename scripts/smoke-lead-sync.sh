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
    EV="$HELIOS_DATA_DIR/runs/$RUN_ID/evidence"
    [[ -d "$EV" ]] || { echo "missing evidence dir $EV" >&2; exit 1; }
    ls "$EV" >/dev/null
    # second run: same CLI step order
    RUN2=$(curl -sf -X POST "http://127.0.0.1:18080/api/v1/workflows/demo.lead-sync/runs" \
      -H 'content-type: application/json' \
      -d '{"params":{"lead_id":"L-123"}}')
    RID2=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN2")
    for j in $(seq 1 100); do
      ST2=$(curl -sf "http://127.0.0.1:18080/api/v1/runs/$RID2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
      [[ "$ST2" == "WAITING_APPROVAL" ]] && break
      [[ "$ST2" == "FAILED" || "$ST2" == "ABORTED" ]] && exit 1
      sleep 0.1
    done
    curl -sf -X POST "http://127.0.0.1:18080/api/v1/runs/$RID2/approval" \
      -H 'content-type: application/json' \
      -d '{"stepId":"approve","decision":"approve","actor":"script"}' >/dev/null
    for j in $(seq 1 100); do
      ST2=$(curl -sf "http://127.0.0.1:18080/api/v1/runs/$RID2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
      [[ "$ST2" == "COMPLETED" ]] && break
      [[ "$ST2" == "FAILED" || "$ST2" == "ABORTED" ]] && exit 1
      sleep 0.1
    done
    python3 - <<PY2
import json, urllib.request
def cli_order(rid):
    with urllib.request.urlopen(f"http://127.0.0.1:18080/api/v1/runs/{rid}") as r:
        run = json.load(r)["run"]
    return [s["stepId"] for s in run["stepRuns"] if s.get("status")=="COMPLETED"]
a, b = cli_order("$RUN_ID"), cli_order("$RID2")
assert a == b, (a, b)
print("OK run=%s run2=%s status=COMPLETED evidence=yes order_stable=yes" % ("$RUN_ID", "$RID2"))
PY2
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
