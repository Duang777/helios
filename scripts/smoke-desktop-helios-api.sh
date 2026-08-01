#!/usr/bin/env bash
# Slice T：桌面业务路径依赖的 Helios API 验收（不启 Electron）。
# 覆盖 opencli.demo-read（HN）——与桌面快捷建议「帮我看看 Hacker News 热帖」同一剧本。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${HELIOS_API_BASE:-http://127.0.0.1:8080/api/v1}"

if ! curl -sf "${API}/health" >/dev/null; then
  echo "Helios API not up at ${API}. Start with ./scripts/dev-api.sh or ./scripts/dev-api-hatchet.sh"
  exit 1
fi

HEALTH=$(curl -sf "${API}/health")
echo "health: $HEALTH"

# ensure workflow + CLI (idempotent)
if [[ -x "$HOME/.helios/bin/helios-opencli" ]]; then
  OPENCLI="$HOME/.helios/bin/helios-opencli"
elif [[ -x "$ROOT/backend/bin/helios-opencli" ]]; then
  OPENCLI="$ROOT/backend/bin/helios-opencli"
else
  mkdir -p "$ROOT/.helios-dev/bin"
  (cd "$ROOT/backend" && go build -o "$ROOT/.helios-dev/bin/helios-opencli" ./cmd/helios-opencli)
  OPENCLI="$ROOT/.helios-dev/bin/helios-opencli"
fi

curl -sf -X POST "${API}/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-opencli\",\"path\":\"$OPENCLI\"}" >/dev/null || true

curl -sf -X PUT "${API}/workflows/opencli.demo-read" \
  -H 'content-type: application/yaml' \
  --data-binary @"$ROOT/workflows/opencli.demo-read.yaml" >/dev/null

RUN=$(curl -sf -X POST "${API}/workflows/opencli.demo-read/runs" \
  -H 'content-type: application/json' -d '{}')
RUN_ID=$(echo "$RUN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])')
echo "run=$RUN_ID"

for i in $(seq 1 80); do
  ST=$(curl -sf "${API}/runs/$RUN_ID")
  STATUS=$(echo "$ST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$STATUS" == "COMPLETED" ]]; then
    echo "$ST" | python3 -c '
import json,sys
run=json.load(sys.stdin)["run"]
assert run["status"]=="COMPLETED"
steps=run.get("stepRuns") or []
assert any(s.get("status")=="COMPLETED" for s in steps), steps
print("smoke-desktop-helios-api OK (opencli.demo-read COMPLETED)")
'
    exit 0
  fi
  if [[ "$STATUS" == "FAILED" || "$STATUS" == "ABORTED" ]]; then
    echo "run failed: $STATUS"; echo "$ST"; exit 1
  fi
  sleep 0.25
done
echo "timeout status=$STATUS"; exit 1
