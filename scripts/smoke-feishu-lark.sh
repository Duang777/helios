#!/usr/bin/env bash
# Feishu wrapper smoke (no tenant credentials required):
# build helios-lark → introspect allowlist → register → doctor run produces evidence
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

INTRO=$("$BIN/helios-lark" introspect)
python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["name"]=="helios-lark", d
assert d["version"]=="0.2.0", d["version"]
paths=[" ".join(c["path"]) for c in d["commands"]]
for need in ("doctor","docs +search","calendar +create","task +get-my-tasks","sheets +cells-get","im +chat-list"):
    assert need in paths, (need, paths)
' <<<"$INTRO"
echo "introspect ok (v0.2.0 allowlist)"

export HELIOS_DATA_DIR="$DATA/helios"
export PORT=18085
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18085/api/v1/health" >/dev/null && break
  sleep 0.1
done
curl -sf "http://127.0.0.1:18085/api/v1/health" >/dev/null

curl -sf -X POST "http://127.0.0.1:18085/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-lark\",\"path\":\"$BIN/helios-lark\"}" >/dev/null

for wf in \
  feishu.doctor.yaml \
  feishu.auth-status.yaml \
  feishu.send-text.yaml \
  feishu.calendar-agenda.yaml \
  feishu.chat-list.yaml \
  feishu.my-tasks.yaml \
  feishu.docs-search.yaml \
  feishu.sheets-cells-get.yaml \
  feishu.calendar-create.yaml
do
  curl -sf -X PUT "http://127.0.0.1:18085/api/v1/workflows/${wf%.yaml}" \
    -H 'content-type: application/yaml' \
    --data-binary @"$ROOT/workflows/$wf" >/dev/null
done
echo "workflows registered"

# doctor may fail without tenant config; we only require the run to finish with evidence
RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18085/api/v1/workflows/feishu.doctor/runs" \
  -H 'content-type: application/json' \
  -d '{}')
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

STATUS=""
for i in $(seq 1 80); do
  BODY=$(curl -sf "http://127.0.0.1:18085/api/v1/runs/$RUN_ID")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])' <<<"$BODY")
  if [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    break
  fi
  sleep 0.15
done

if [[ "$STATUS" != "COMPLETED" && "$STATUS" != "FAILED" ]]; then
  echo "unexpected status=$STATUS" >&2
  echo "$BODY" >&2
  cat "$DATA/server.log" >&2
  exit 1
fi

# allowlist rejection must not happen for doctor
python3 -c '
import json,sys
run=json.load(sys.stdin)["run"]
for s in run.get("stepRuns") or []:
    err=(s.get("error") or "")
    if "not allowlisted" in err:
        raise SystemExit(f"allowlist failure: {err}")
' <<<"$BODY"

EV_DIR="$HELIOS_DATA_DIR/runs/$RUN_ID/evidence"
[[ -d "$EV_DIR" ]] || { echo "missing evidence dir $EV_DIR" >&2; exit 1; }
echo "smoke-feishu-lark ok (doctor status=$STATUS, evidence present)"
