#!/usr/bin/env bash
# Lathe engine smoke: require lathe on PATH, generate → build wrap → introspect → register.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
BIN="$DATA/bin"
mkdir -p "$BIN"

cleanup() {
  rm -rf "$DATA"
  rm -rf "$ROOT/backend/.tmp-factory-lathe-smoke"
}
trap cleanup EXIT

export PATH="${PATH:-/usr/bin:/bin}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
fi
export PATH="$(go env GOPATH)/bin:$PATH"

if ! command -v lathe >/dev/null 2>&1; then
  echo "SKIP: lathe not on PATH — ${ROOT}/docs/architecture/slice-g-lathe-adapter.md" >&2
  echo "install: go install github.com/lathe-cli/lathe/cmd/lathe@v0.5.2" >&2
  exit 0
fi

cd "$ROOT/backend"
mkdir -p .tmp-factory-lathe-smoke

go run ./cmd/helios-factory generate \
  --engine=lathe \
  --openapi "$ROOT/examples/cli-factory/demo-inventory.openapi.yaml" \
  --name demo-inv-lathe \
  --out .tmp-factory-lathe-smoke/demo-inv-lathe

cd .tmp-factory-lathe-smoke/demo-inv-lathe
go build -o bin/demo-inv-lathe ./helios-wrap

./bin/demo-inv-lathe introspect | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["name"]=="demo-inv-lathe"
assert any(c["path"]==["introspect"] for c in d["commands"])
assert any("create" in " ".join(c["path"]) for c in d["commands"])
print("introspect ok engine=lathe")
'

cd "$ROOT/backend"
go build -o "$BIN/helios" ./cmd/helios
echo "OK lathe factory smoke (introspect+build)"
