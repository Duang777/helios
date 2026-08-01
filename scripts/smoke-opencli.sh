#!/usr/bin/env bash
# Slice P: helios-opencli introspect + opencli.demo-read (HN top via OpenCLI).
# If opencli cannot be resolved, SKIP with exit 0 (optional CI gate).
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
export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
fi
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

# Resolve / shim opencli
if [[ -n "${HELIOS_OPENCLI_BIN:-}" && -x "${HELIOS_OPENCLI_BIN}" ]]; then
  :
elif command -v opencli >/dev/null 2>&1; then
  export HELIOS_OPENCLI_BIN="$(command -v opencli)"
elif command -v npx >/dev/null 2>&1; then
  cat >"$BIN/opencli-shim" <<'SH'
#!/usr/bin/env bash
exec npx --yes @jackwener/opencli@1.8.6 "$@"
SH
  chmod +x "$BIN/opencli-shim"
  export HELIOS_OPENCLI_BIN="$BIN/opencli-shim"
else
  echo "SKIP: opencli not available (no HELIOS_OPENCLI_BIN / opencli / npx)"
  exit 0
fi

cd "$ROOT/backend"
go test ./cmd/helios-opencli/
go build -o "$BIN/helios" ./cmd/helios
go build -o "$BIN/helios-opencli" ./cmd/helios-opencli

INTRO=$("$BIN/helios-opencli" introspect)
python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["name"]=="helios-opencli", d
assert d["version"]=="0.1.0", d["version"]
paths=[" ".join(c["path"]) for c in d["commands"]]
for need in ("list","doctor","hackernews top"):
    assert need in paths, (need, paths)
assert "browser" not in paths
' <<<"$INTRO"
echo "introspect ok (v0.1.0 allowlist)"

# Direct wrapper call (proves envelope)
DIRECT=$("$BIN/helios-opencli" hackernews top --limit 2 -f json)
python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d.get("ok") is True, d
data=d.get("data")
assert isinstance(data, list) and len(data)>=1, data
assert "title" in data[0], data[0]
print("direct ok stories=", len(data), "title0=", data[0].get("title","")[:60])
' <<<"$DIRECT"

export HELIOS_DATA_DIR="$DATA/helios"
export PORT=18095
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18095/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18095/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-opencli\",\"path\":\"$BIN/helios-opencli\"}" >/dev/null

curl -sf -X PUT "http://127.0.0.1:18095/api/v1/workflows/opencli.demo-read" \
  -H 'content-type: application/yaml' \
  --data-binary @"$ROOT/workflows/opencli.demo-read.yaml" >/dev/null

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18095/api/v1/workflows/opencli.demo-read/runs" \
  -H 'content-type: application/json' \
  -d '{}')
RID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

for i in $(seq 1 120); do
  ST=$(curl -sf "http://127.0.0.1:18095/api/v1/runs/$RID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$ST" == "COMPLETED" ]]; then
    EV="$HELIOS_DATA_DIR/runs/$RID/evidence"
    [[ -d "$EV" ]] || { echo "missing evidence"; exit 1; }
    echo "OK run=$RID status=COMPLETED evidence=yes"
    exit 0
  fi
  if [[ "$ST" == "FAILED" || "$ST" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18095/api/v1/runs/$RID" >&2
    cat "$DATA/server.log" >&2 || true
    exit 1
  fi
  sleep 0.25
done
echo "timeout" >&2
cat "$DATA/server.log" >&2 || true
exit 1
