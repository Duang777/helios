#!/usr/bin/env bash
# Gated live compile smoke (Slice J).
# No credentials → SKIP exit 0. With credentials → assert mode=live + valid YAML.
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
fi
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

LIVE_ENV="$ROOT/.helios-dev/pi-live.env"
if [[ -f "$LIVE_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$LIVE_ENV"
fi

has_auth=0
for v in HELIOS_PI_API_KEY CFMAX_API_KEY XPA_RELAY_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY; do
  if [[ -n "${!v:-}" ]]; then
    has_auth=1
    break
  fi
done

if [[ "$has_auth" -ne 1 ]]; then
  echo "SKIP: no live auth (set CFMAX_API_KEY / HELIOS_PI_API_KEY or source .helios-dev/pi-live.env)"
  exit 0
fi

export HELIOS_PI_MODE=live
export HELIOS_PI_PORT=18092

cd "$ROOT/backend"
go build -o "$BIN/demo-crm" ./cmd/demo-crm
go build -o "$BIN/demo-erp" ./cmd/demo-erp
go build -o "$BIN/helios" ./cmd/helios

cd "$ROOT/packages/pi-sidecar"
[[ -d node_modules/@earendil-works/pi-coding-agent ]] || npm install >/dev/null

node src/server.js >"$DATA/pi.log" 2>&1 &
PI_PID=$!
for i in $(seq 1 80); do
  curl -sf "http://127.0.0.1:18092/health" >/dev/null && break
  sleep 0.15
done
HEALTH=$(curl -sf "http://127.0.0.1:18092/health")
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["mode"]=="live", d' <<<"$HEALTH"

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_PI_SIDECAR_URL="http://127.0.0.1:18092"
export PORT=18081
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18081/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18081/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:18081/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

RESP=$(curl -s -m 120 -w "\n%{http_code}" -X POST "http://127.0.0.1:18081/api/v1/compile" \
  -H 'content-type: application/json' \
  -d '{"intent":"把线索 L-123 同步成采购单，写前要审批"}') || {
  echo "compile request failed" >&2
  cat "$DATA/pi.log" >&2
  cat "$DATA/server.log" >&2
  exit 1
}
HTTP_CODE=$(tail -n1 <<<"$RESP")
BODY=$(sed '$d' <<<"$RESP")

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "422" ]]; then
  echo "unexpected http=$HTTP_CODE body=$BODY" >&2
  cat "$DATA/pi.log" >&2
  exit 1
fi

python3 -c '
import json,sys
d=json.load(sys.stdin)
attempts=d.get("attempts") or []
modes=[a.get("mode") for a in attempts] + ([d.get("mode")] if d.get("mode") else [])
assert "live" in modes, {"modes": modes, "body": d}
assert "yaml" in d and "apiVersion" in (d.get("yaml") or ""), d
print("live compile ok: http=%s mode=%s model=%s validation=%s attempts=%d" % (
  '"$HTTP_CODE"', d.get("mode") or (attempts[-1].get("mode") if attempts else None),
  d.get("model") or (attempts[-1].get("model") if attempts else None),
  (d.get("validation") or {}).get("ok"), len(attempts)))
' <<<"$BODY"
