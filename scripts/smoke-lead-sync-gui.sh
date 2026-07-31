#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

GUI_PID=""
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${GUI_PID:-}" ]]; then
    kill "$GUI_PID" 2>/dev/null || true
  fi
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
go build -o "$BIN/demo-crm" ./cmd/demo-crm
go build -o "$BIN/demo-erp" ./cmd/demo-erp
go build -o "$BIN/helios" ./cmd/helios

export HELIOS_GUI_MODE="${HELIOS_GUI_MODE:-playwright}"
export HELIOS_GUI_PORT=18792

# Ensure Playwright Chromium when using real browser mode
if [[ "$HELIOS_GUI_MODE" == "playwright" ]]; then
  (
    cd "$ROOT/packages/gui-operator"
    if [[ ! -d node_modules/playwright ]]; then
      npm install >/dev/null
    fi
    npx playwright install chromium >/dev/null
  )
fi

node "$ROOT/packages/gui-operator/src/server.js" >"$DATA/gui.log" 2>&1 &
GUI_PID=$!

for i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:18792/health" >/dev/null; then
    break
  fi
  sleep 0.1
done
curl -sf "http://127.0.0.1:18792/health" >/dev/null

export HELIOS_DATA_DIR="$DATA/helios"
export HELIOS_BOOTSTRAP_WORKFLOW="$ROOT/workflows/demo.lead-sync-gui.yaml"
export HELIOS_GUI_OPERATOR_URL="http://127.0.0.1:18792"
export DEMO_ERP_NEEDS_GUI=1
export PORT=18081

"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:18081/api/v1/health" >/dev/null; then
    break
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18081/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-crm\",\"path\":\"$BIN/demo-crm\"}" >/dev/null
curl -sf -X POST "http://127.0.0.1:18081/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"demo-erp\",\"path\":\"$BIN/demo-erp\"}" >/dev/null

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18081/api/v1/workflows/demo.lead-sync-gui/runs" \
  -H 'content-type: application/json' \
  -d '{"params":{"lead_id":"L-123"}}')
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18081/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "WAITING_APPROVAL" ]]; then
    break
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed early: $STATUS" >&2
    curl -sf "http://127.0.0.1:18081/api/v1/runs/$RUN_ID" >&2
    cat "$DATA/server.log" >&2 || true
    exit 1
  fi
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18081/api/v1/runs/$RUN_ID/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"script"}' >/dev/null

for i in $(seq 1 100); do
  STATUS=$(curl -sf "http://127.0.0.1:18081/api/v1/runs/$RUN_ID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "COMPLETED" ]]; then
    python3 - "$HELIOS_DATA_DIR" "$RUN_ID" <<'PY'
import json, sys, pathlib
data, run_id = sys.argv[1], sys.argv[2]
run = json.loads(pathlib.Path(data, "runs", run_id, "run.json").read_text())
gui = next(s for s in run["stepRuns"] if s["stepId"] == "gui_confirm")
assert gui["status"] == "COMPLETED", gui
ev = next(e for e in run["evidence"] if e.get("type") == "gui")
assert ev.get("screenshotRef"), ev
png = pathlib.Path(data, "runs", run_id, ev["screenshotRef"])
assert png.is_file() and png.stat().st_size > 500, (png, png.stat().st_size)
mode = (gui.get("output") or {}).get("mode")
print("OK run=%s gui_confirm COMPLETED mode=%s screenshot=%s bytes=%d" % (run_id, mode, ev["screenshotRef"], png.stat().st_size))
PY
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed: $STATUS" >&2
    curl -sf "http://127.0.0.1:18081/api/v1/runs/$RUN_ID" >&2
    cat "$DATA/server.log" >&2 || true
    cat "$DATA/gui.log" >&2 || true
    exit 1
  fi
  sleep 0.1
done

echo "timeout waiting for COMPLETED" >&2
cat "$DATA/server.log" >&2 || true
exit 1
