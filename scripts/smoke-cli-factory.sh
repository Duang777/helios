#!/usr/bin/env bash
# Self-contained CLI factory smoke: generate → build → register → run workflow.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

SERVER_PID=""
API_PID=""
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  rm -rf "$DATA"
  rm -rf "$ROOT/backend/.tmp-factory-smoke"
}
trap cleanup EXIT

export PATH="${PATH:-/usr/bin:/bin}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
fi

cd "$ROOT/backend"

# 1) OpenAPI → factory spec → generate under module
mkdir -p .tmp-factory-smoke
go run ./cmd/helios-factory from-openapi \
  --openapi "$ROOT/examples/cli-factory/demo-inventory.openapi.yaml" \
  --name demo-inventory \
  --out .tmp-factory-smoke/from-openapi.factory.json

go run ./cmd/helios-factory generate \
  --spec .tmp-factory-smoke/from-openapi.factory.json \
  --out .tmp-factory-smoke/demo-inventory

go build -o "$BIN/demo-inventory" ./.tmp-factory-smoke/demo-inventory
go build -o "$BIN/demo-inventory-api" ./cmd/demo-inventory-api
go build -o "$BIN/helios" ./cmd/helios

# introspect sanity
"$BIN/demo-inventory" introspect | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["name"]=="demo-inventory"
assert any(c["path"]==["items","create"] for c in d["commands"])
print("introspect ok")
'

# Real inventory HTTP API (not FileDB)
export DEMO_INVENTORY_API_ADDR="127.0.0.1:18795"
export DEMO_INVENTORY_BASE_URL="http://127.0.0.1:18795"
"$BIN/demo-inventory-api" >"$DATA/api.log" 2>&1 &
API_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18795/health" >/dev/null && break
  sleep 0.1
done
curl -sf "http://127.0.0.1:18795/health" >/dev/null

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.inventory-create.yaml"
export PORT=18083
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18083/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18083/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-inventory\",\"path\":\"$BIN/demo-inventory\"}" >/dev/null

ITEM='{"id":"SKU-42","title":"Factory Widget","qty":3}'
RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18083/api/v1/workflows/demo.inventory-create/runs" \
  -H 'content-type: application/json' \
  -d "{\"params\":{\"item_json\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$ITEM")}}")
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18083/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "WAITING_APPROVAL" ]]; then break; fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18083/api/v1/runs/$RUN_ID" >&2
    cat "$DATA/server.log" >&2
    exit 1
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18083/api/v1/runs/$RUN_ID/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"smoke"}' >/dev/null

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18083/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "COMPLETED" ]]; then
    python3 - "$HELIOS_DATA_DIR" "$RUN_ID" <<'PY'
import json,sys,pathlib
data, rid = sys.argv[1], sys.argv[2]
run = json.loads(pathlib.Path(data,"runs",rid,"run.json").read_text())
create = next(s for s in run["stepRuns"] if s["stepId"]=="create")
assert create["status"]=="COMPLETED", create
item = (create.get("output") or {}).get("data") or {}
assert item.get("id")=="SKU-42", item
print("OK factory smoke run=%s item=%s" % (rid, item.get("id")))
PY
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18083/api/v1/runs/$RUN_ID" >&2
    cat "$DATA/server.log" >&2
    exit 1
  fi
  sleep 0.1
done
echo timeout >&2
cat "$DATA/server.log" >&2
exit 1
