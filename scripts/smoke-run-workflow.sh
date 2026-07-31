#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${HELIOS_API:-http://127.0.0.1:8080/api/v1}"

curl -sf "$API/health" >/dev/null

# ensure workflow saved
curl -sf -X PUT "$API/workflows/demo.lead-sync-ai" \
  -H 'content-type: application/yaml' \
  --data-binary @"$ROOT/workflows/demo.lead-sync-ai.yaml" >/dev/null

curl -sf -X POST "$API/workflows/demo.lead-sync-ai/publish" >/dev/null

# unknown param rejected
code=$(curl -s -o /tmp/helios-rw-bad.json -w '%{http_code}' -X POST "$API/run_workflow" \
  -H 'content-type: application/json' \
  -d '{"id":"demo.lead-sync-ai","params":{"lead_id":"L-123","nope":1}}')
[[ "$code" == "422" ]] || { echo "expected 422 got $code"; cat /tmp/helios-rw-bad.json; exit 1; }

RESP=$(curl -sf -X POST "$API/run_workflow" \
  -H 'content-type: application/json' \
  -d '{"id":"demo.lead-sync-ai","params":{"lead_id":"L-123"}}')
RID=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["id"])')

for i in $(seq 1 40); do
  st=$(curl -sf "$API/runs/$RID" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$st" == "WAITING_APPROVAL" ]]; then
    break
  fi
  if [[ "$st" == "FAILED" || "$st" == "ABORTED" ]]; then
    curl -sf "$API/runs/$RID"; exit 1
  fi
  sleep 0.25
done

curl -sf -X POST "$API/runs/$RID/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"smoke"}' >/dev/null

for i in $(seq 1 40); do
  st=$(curl -sf "$API/runs/$RID" | python3 -c 'import sys,json; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$st" == "COMPLETED" ]]; then
    echo "run_workflow ok: $RID"
    exit 0
  fi
  if [[ "$st" == "FAILED" || "$st" == "ABORTED" ]]; then
    curl -sf "$API/runs/$RID"; exit 1
  fi
  sleep 0.25
done
echo timeout; exit 1
