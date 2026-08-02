#!/usr/bin/env bash
# Slice V：桌面 NL 编译闭环的 API 侧验收（不启 Electron）。
# compile → save → run → WAITING_APPROVAL（mock Pi）。
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
export HELIOS_PI_SIDECAR_URL="http://127.0.0.1:18092"
export PORT=18081
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

API="http://127.0.0.1:18081/api/v1"
for i in $(seq 1 50); do
  curl -sf "${API}/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "${API}/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "${API}/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

INTENT='把线索 L-123 同步成采购单，写前要审批'
COMPILED=$(curl -sf -X POST "${API}/compile" \
  -H 'content-type: application/json' \
  -d "$(python3 -c "import json; print(json.dumps({'intent': '''$INTENT'''}))")")

echo "$COMPILED" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["validation"]["ok"] is True, d
assert d.get("workflow",{}).get("id") == "demo.lead-sync", d
assert "demo.lead-sync" in d["yaml"]
print("compile ok: workflow=%s mode=%s" % (d["workflow"]["id"], d.get("mode")))
'

WF_ID=$(echo "$COMPILED" | python3 -c 'import json,sys; print(json.load(sys.stdin)["workflow"]["id"])')
YAML=$(echo "$COMPILED" | python3 -c 'import json,sys; print(json.load(sys.stdin)["yaml"])')

curl -sf -X PUT "${API}/workflows/${WF_ID}" \
  -H 'content-type: application/yaml' \
  --data-binary "$YAML" >/dev/null
echo "save ok: $WF_ID"

RUN=$(curl -sf -X POST "${API}/workflows/${WF_ID}/runs" \
  -H 'content-type: application/json' \
  -d '{"params":{"lead_id":"L-123"}}')
RUN_ID=$(echo "$RUN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])')
echo "run=$RUN_ID"

STATUS=""
for i in $(seq 1 80); do
  ST=$(curl -sf "${API}/runs/$RUN_ID")
  STATUS=$(echo "$ST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "WAITING_APPROVAL" || "$STATUS" == "COMPLETED" ]]; then
    echo "$ST" | python3 -c '
import json,sys
run=json.load(sys.stdin)["run"]
assert run["status"] in ("WAITING_APPROVAL","COMPLETED"), run
print("smoke-desktop-nl-compile OK (status=%s)" % run["status"])
'
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed: $STATUS"; echo "$ST"; exit 1
  fi
  sleep 0.25
done

echo "timeout status=$STATUS"; exit 1
