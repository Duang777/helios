#!/usr/bin/env bash
# human_help handoff smoke: WAITING_HUMAN → viewer resolve OR API resolve → COMPLETED
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

GUI_PID=""
SERVER_PID=""
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "${GUI_PID:-}" ]] && kill "$GUI_PID" 2>/dev/null || true
  rm -rf "$DATA"
}
trap cleanup EXIT

export PATH="${PATH:-/usr/bin:/bin}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
fi
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

cd "$ROOT/backend"
go build -o "$BIN/helios" ./cmd/helios

export HELIOS_GUI_MODE="${HELIOS_GUI_MODE:-fake}"
export HELIOS_GUI_PORT=18793
if [[ "$HELIOS_GUI_MODE" == "playwright" ]]; then
  (
    cd "$ROOT/packages/gui-operator"
    [[ -d node_modules/playwright ]] || npm install >/dev/null
    npx playwright install chromium >/dev/null
  )
fi

node "$ROOT/packages/gui-operator/src/server.js" >"$DATA/gui.log" 2>&1 &
GUI_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18793/health" >/dev/null && break
  sleep 0.1
done
curl -sf "http://127.0.0.1:18793/health" >/dev/null

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.human-help.yaml"
export HELIOS_GUI_OPERATOR_URL="http://127.0.0.1:18793"
export PORT=18084
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18084/api/v1/health" >/dev/null && break
  sleep 0.1
done

LOGIN_URL="http://127.0.0.1:18793/fixture/confirm.html"
RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18084/api/v1/workflows/demo.human-help/runs" \
  -H 'content-type: application/json' \
  -d "{\"params\":{\"login_url\":\"$LOGIN_URL\"}}")
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

VIEWER=""
for i in $(seq 1 100); do
  BODY=$(curl -sf "http://127.0.0.1:18084/api/v1/runs/$RUN_ID")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])' <<<"$BODY")
  if [[ "$STATUS" == "WAITING_HUMAN" ]]; then
    VIEWER=$(python3 -c '
import json,sys
run=json.load(sys.stdin)["run"]
step=next(s for s in run["stepRuns"] if s["stepId"]=="need_help")
print((step.get("output") or {}).get("viewerUrl") or "")
' <<<"$BODY")
    break
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "$BODY" >&2
    cat "$DATA/server.log" >&2
    cat "$DATA/gui.log" >&2
    exit 1
  fi
  sleep 0.1
done

if [[ -z "$VIEWER" ]]; then
  echo "missing viewerUrl" >&2
  exit 1
fi

# Prefer verifying viewer UI, then unblock via Helios API (engine channel)
if ! curl -sf "$VIEWER" | grep -q '人工协助'; then
  echo "viewer page missing handoff UI: $VIEWER" >&2
  exit 1
fi

curl -sf -X POST "http://127.0.0.1:18084/api/v1/runs/$RUN_ID/human-help" \
  -H 'content-type: application/json' \
  -d '{"stepId":"need_help","ok":true,"note":"smoke","actor":"smoke"}' >/dev/null

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18084/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "COMPLETED" ]]; then
    python3 - "$HELIOS_DATA_DIR" "$RUN_ID" "$VIEWER" <<'PY'
import json,sys,pathlib
data, rid, viewer = sys.argv[1], sys.argv[2], sys.argv[3]
run = json.loads(pathlib.Path(data,"runs",rid,"run.json").read_text())
step = next(s for s in run["stepRuns"] if s["stepId"]=="need_help")
assert step["status"]=="COMPLETED", step
out = step.get("output") or {}
assert out.get("ok") is True
assert out.get("viewerUrl")==viewer or out.get("viewerUrl")
print("OK human_help run=%s mode=%s viewer=%s" % (rid, out.get("mode"), out.get("viewerUrl")))
PY
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18084/api/v1/runs/$RUN_ID" >&2
    exit 1
  fi
  sleep 0.1
done
echo timeout >&2
exit 1
