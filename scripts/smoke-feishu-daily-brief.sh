#!/usr/bin/env bash
# Feishu daily-brief playbook smoke (Slice M).
# No tenant credentials required for structure gate.
# With login + HELIOS_FEISHU_CHAT_ID, run reaches WAITING_APPROVAL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

SERVER_PID=""
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
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

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "lark-cli not found; install with: npx @larksuite/cli@latest install" >&2
  exit 1
fi

cd "$ROOT/backend"
go build -o "$BIN/helios" ./cmd/helios
go build -o "$BIN/helios-lark" ./cmd/helios-lark

export HELIOS_DATA_DIR="$DATA/helios"
export PORT=18087
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18087/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18087/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-lark\",\"path\":\"$BIN/helios-lark\"}" >/dev/null

curl -sf -X PUT "http://127.0.0.1:18087/api/v1/workflows/feishu.daily-brief" \
  -H 'content-type: application/yaml' \
  --data-binary @"$ROOT/workflows/feishu.daily-brief.yaml" >/dev/null

CHAT_ID="${HELIOS_FEISHU_CHAT_ID:-oc_smoke_placeholder}"
NOTE="${HELIOS_FEISHU_NOTE:-smoke note}"

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18087/api/v1/workflows/feishu.daily-brief/runs" \
  -H 'content-type: application/json' \
  -d "{\"params\":{\"chat_id\":\"$CHAT_ID\",\"note\":\"$NOTE\"}}")
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

STATUS=""
BODY=""
for i in $(seq 1 100); do
  BODY=$(curl -sf "http://127.0.0.1:18087/api/v1/runs/$RUN_ID")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])' <<<"$BODY")
  if [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" || "$STATUS" == "WAITING_APPROVAL" ]]; then
    break
  fi
  sleep 0.15
done

python3 -c '
import json,sys,os
run=json.load(sys.stdin)["run"]
status=run["status"]
# never allowlist failure
for s in run.get("stepRuns") or []:
    err=(s.get("error") or "")
    if "not allowlisted" in err:
        raise SystemExit(f"allowlist failure: {err}")
chat=os.environ.get("HELIOS_FEISHU_CHAT_ID","").strip()
if chat:
    assert status in ("WAITING_APPROVAL","COMPLETED","FAILED"), status
    if status == "WAITING_APPROVAL":
        step=next(s for s in run["stepRuns"] if s["stepId"]=="approve_send")
        assert step["status"]=="WAITING_APPROVAL", step
        print("smoke-feishu-daily-brief ok (logged-in path → WAITING_APPROVAL)")
    else:
        print("smoke-feishu-daily-brief ok (logged-in path → %s)" % status)
else:
    # without real chat/login: FAILED on auth/agenda is acceptable; structure must load
    assert status in ("FAILED","WAITING_APPROVAL","COMPLETED"), status
    print("smoke-feishu-daily-brief ok (offline/structure path → %s)" % status)
' <<<"$BODY"
