#!/usr/bin/env bash
# Multi-step GUI run smoke (Slice L). Defaults to fake; set HELIOS_GUI_MODE=playwright for Chromium.
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
export HELIOS_GUI_PORT=18794
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
  curl -sf "http://127.0.0.1:18794/health" >/dev/null && break
  sleep 0.1
done

FORM_URL="http://127.0.0.1:18794/fixture/form.html"
export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.gui-run.yaml"
export HELIOS_GUI_OPERATOR_URL="http://127.0.0.1:18794"
export PORT=18086
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18086/api/v1/health" >/dev/null && break
  sleep 0.1
done

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18086/api/v1/workflows/demo.gui-run/runs" \
  -H 'content-type: application/json' \
  -d "{\"params\":{\"form_url\":\"$FORM_URL\",\"note\":\"Slice L\"}}")
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

STATUS=""
BODY=""
for i in $(seq 1 100); do
  BODY=$(curl -sf "http://127.0.0.1:18086/api/v1/runs/$RUN_ID")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])' <<<"$BODY")
  if [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    break
  fi
  sleep 0.15
done

if [[ "$STATUS" != "COMPLETED" ]]; then
  echo "expected COMPLETED, got $STATUS" >&2
  echo "$BODY" >&2
  cat "$DATA/gui.log" >&2
  cat "$DATA/server.log" >&2
  exit 1
fi

python3 -c '
import json,sys,os
run=json.load(sys.stdin)["run"]
step=next(s for s in run["stepRuns"] if s["stepId"]=="fill_form")
assert step["status"]=="COMPLETED", step
out=step.get("output") or {}
assert out.get("action")=="run", out
assert out.get("ok") is True, out
shot=out.get("screenshotPath") or ""
assert shot.endswith(".png"), out
path=os.path.join(os.environ["HELIOS_DATA_DIR"], "runs", run["id"], shot)
assert os.path.isfile(path) and os.path.getsize(path) > 8, path
print("smoke-gui-run ok mode=%s shot=%s" % (out.get("mode"), shot))
' <<<"$BODY"
