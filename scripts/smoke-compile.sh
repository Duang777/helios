#!/usr/bin/env bash
# Self-contained compile smoke (mock Pi + Helios API).
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
# Prefer a Go that satisfies go.mod (>=1.26.1) when mise is present
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
export HELIOS_PI_PORT=18091
node "$ROOT/packages/pi-sidecar/src/server.js" >"$DATA/pi.log" 2>&1 &
PI_PID=$!

for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18091/health" >/dev/null && break
  sleep 0.1
done

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_PI_SIDECAR_URL="http://127.0.0.1:18091"
export PORT=18080
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18080/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18080/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:18080/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

RESP=$(curl -sf -X POST "http://127.0.0.1:18080/api/v1/compile" \
  -H 'content-type: application/json' \
  -d '{"intent":"把线索 L-123 同步成采购单，写前要审批"}')

echo "$RESP" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["validation"]["ok"] is True, d
assert "demo.lead-sync" in d["yaml"]
assert d.get("mode") == "mock", d
print("compile ok: mode=%s attempts=%d" % (d.get("mode"), len(d.get("attempts",[]))))
'
