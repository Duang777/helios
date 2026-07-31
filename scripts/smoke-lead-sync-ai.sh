#!/usr/bin/env bash
# Self-contained AI workflow smoke (mock Pi + Helios API).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

PI_PID=""
SERVER_PID=""

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "${PI_PID:-}" ]] && kill "$PI_PID" 2>/dev/null || true
  rm -rf "$DATA"
}
trap cleanup EXIT

export PATH="${PATH:-/usr/bin:/bin}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
elif [[ -x "$HOME/.local/share/mise/installs/go/1.26/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26/bin:$PATH"
fi
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

cd "$ROOT/backend"
go build -o "$BIN/demo-crm" ./cmd/demo-crm
go build -o "$BIN/demo-erp" ./cmd/demo-erp
go build -o "$BIN/helios" ./cmd/helios

export HELIOS_PI_MODE=mock
export HELIOS_PI_PORT=18092
node "$ROOT/packages/pi-sidecar/src/server.js" >"$DATA/pi.log" 2>&1 &
PI_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18092/health" >/dev/null && break
  sleep 0.1
done

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.lead-sync-ai.yaml"
export HELIOS_PI_SIDECAR_URL="http://127.0.0.1:18092"
export PORT=18082
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18082/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18082/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:18082/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

curl -sf -X POST "http://127.0.0.1:18082/api/v1/workflows/demo.lead-sync-ai/publish" >/dev/null

# unknown param rejected
code=$(curl -s -o /tmp/helios-rw-bad.json -w '%{http_code}' -X POST "http://127.0.0.1:18082/api/v1/run_workflow" \
  -H 'content-type: application/json' \
  -d '{"id":"demo.lead-sync-ai","params":{"lead_id":"L-123","nope":1}}')
[[ "$code" == "422" ]] || { echo "expected 422 got $code"; cat /tmp/helios-rw-bad.json; exit 1; }

RESP=$(curl -sf -X POST "http://127.0.0.1:18082/api/v1/run_workflow" \
  -H 'content-type: application/json' \
  -d '{"id":"demo.lead-sync-ai","params":{"lead_id":"L-123"}}')
RID=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["id"])')

for i in $(seq 1 80); do
  st=$(curl -sf "http://127.0.0.1:18082/api/v1/runs/$RID" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$st" == "WAITING_APPROVAL" ]]; then break; fi
  if [[ "$st" == "FAILED" || "$st" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18082/api/v1/runs/$RID"; cat "$DATA/server.log"; exit 1
  fi
  sleep 0.15
done

curl -sf -X POST "http://127.0.0.1:18082/api/v1/runs/$RID/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"smoke"}' >/dev/null

for i in $(seq 1 80); do
  st=$(curl -sf "http://127.0.0.1:18082/api/v1/runs/$RID" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$st" == "COMPLETED" ]]; then
    python3 - "$HELIOS_DATA_DIR" "$RID" <<'PY'
import json,sys,pathlib
data, rid = sys.argv[1], sys.argv[2]
run = json.loads(pathlib.Path(data,"runs",rid,"run.json").read_text())
ai = next(e for e in run["evidence"] if e.get("type")=="ai")
assert ai["inputSummary"].get("mode")=="mock", ai
assert ai["inputSummary"].get("model"), ai
po = next(s for s in run["stepRuns"] if s["stepId"]=="create_po")
assert po["status"]=="COMPLETED"
title = (po.get("output") or {}).get("data",{}).get("title")
# mock ai uses lead title/company; seed lead L-123 title from demo-crm
assert title, po
print("OK run=%s ai_mode=%s po_title=%s" % (rid, ai["inputSummary"]["mode"], title))
PY
    exit 0
  fi
  if [[ "$st" == "FAILED" || "$st" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18082/api/v1/runs/$RID"; cat "$DATA/server.log"; exit 1
  fi
  sleep 0.15
done
echo timeout; cat "$DATA/server.log"; exit 1
