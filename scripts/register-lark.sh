#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HELIOS_DATA_DIR:-$HOME/.helios}"
PORT="${PORT:-8080}"
BIN_DIR="${HELIOS_BIN_DIR:-$DATA_DIR/bin}"
mkdir -p "$BIN_DIR"

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "lark-cli not found. Install first:"
  echo "  npx @larksuite/cli@latest install"
  exit 1
fi

echo "Building helios-lark wrapper..."
(
  cd "$ROOT/backend"
  go build -o "$BIN_DIR/helios-lark" ./cmd/helios-lark
)

echo "Registering helios-lark at $BIN_DIR/helios-lark"
curl -sf -X POST "http://127.0.0.1:${PORT}/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-lark\",\"path\":\"$BIN_DIR/helios-lark\"}"

echo
echo "Bootstrapping Feishu workflows..."
for wf in \
  feishu.doctor.yaml \
  feishu.auth-status.yaml \
  feishu.send-text.yaml \
  feishu.calendar-agenda.yaml \
  feishu.chat-list.yaml \
  feishu.my-tasks.yaml \
  feishu.docs-search.yaml \
  feishu.sheets-cells-get.yaml \
  feishu.calendar-create.yaml \
  feishu.daily-brief.yaml
do
  curl -sf -X PUT "http://127.0.0.1:${PORT}/api/v1/workflows/${wf%.yaml}" \
    -H 'content-type: application/yaml' \
    --data-binary @"$ROOT/workflows/$wf" >/dev/null
  echo "  saved ${wf%.yaml}"
done

echo
echo "Next:"
echo "  1) lark-cli config init --new    # browser authorize app"
echo "  2) lark-cli auth login --recommend"
echo "  3) Pilot playbook: feishu.daily-brief (agenda → approve → send)"
echo "  4) Or: feishu.doctor / feishu.calendar-agenda / feishu.chat-list"
echo "  5) Docs: docs/feishu-cli.md | design: docs/architecture/slice-m-feishu-daily-brief.md"
