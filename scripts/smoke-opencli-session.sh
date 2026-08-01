#!/usr/bin/env bash
# Slice Q: browser-session OpenCLI (bilibili hot).
# Default: SKIP exit 0 when Bridge/extension unavailable.
# HELIOS_OPENCLI_REQUIRE_SESSION=1 → must COMPLETED.
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
  echo "SKIP: opencli not available"
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
assert d["version"]=="0.2.0", d["version"]
paths=[" ".join(c["path"]) for c in d["commands"]]
for need in ("bilibili hot","bilibili whoami","bilibili login","hackernews top"):
    assert need in paths, (need, paths)
' <<<"$INTRO"
echo "introspect ok (v0.2.0 session allowlist)"

# Probe upstream / wrapper
set +e
PROBE_OUT=$("$BIN/helios-opencli" bilibili hot --limit 2 -f json 2>"$DATA/probe.err")
PROBE_CODE=$?
set -e
echo "$PROBE_OUT" >"$DATA/probe.out"

SKIP_REASON=""
if [[ "$PROBE_CODE" -ne 0 ]]; then
  SKIP_REASON="bilibili hot exit=$PROBE_CODE (bridge/login likely missing)"
elif ! python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True' <<<"$PROBE_OUT" 2>/dev/null; then
  SKIP_REASON="bilibili hot returned ok!=true"
fi

if [[ -n "$SKIP_REASON" ]]; then
  if [[ "${HELIOS_OPENCLI_REQUIRE_SESSION:-}" == "1" ]]; then
    echo "FAIL: $SKIP_REASON" >&2
    cat "$DATA/probe.out" >&2 || true
    cat "$DATA/probe.err" >&2 || true
    exit 1
  fi
  echo "SKIP: $SKIP_REASON"
  echo "hint: install OpenCLI Chrome extension, opencli doctor, optionally bilibili login"
  echo "      then: HELIOS_OPENCLI_REQUIRE_SESSION=1 ./scripts/smoke-opencli-session.sh"
  exit 0
fi

export HELIOS_DATA_DIR="$DATA/helios"
export PORT=18096
"$BIN/helios" >"$DATA/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:18096/api/v1/health" >/dev/null && break
  sleep 0.1
done

curl -sf -X POST "http://127.0.0.1:18096/api/v1/clis/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"helios-opencli\",\"path\":\"$BIN/helios-opencli\"}" >/dev/null

curl -sf -X PUT "http://127.0.0.1:18096/api/v1/workflows/opencli.bilibili-hot" \
  -H 'content-type: application/yaml' \
  --data-binary @"$ROOT/workflows/opencli.bilibili-hot.yaml" >/dev/null

RUN_JSON=$(curl -sf -X POST "http://127.0.0.1:18096/api/v1/workflows/opencli.bilibili-hot/runs" \
  -H 'content-type: application/json' \
  -d '{}')
RID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<<"$RUN_JSON")

for i in $(seq 1 120); do
  ST=$(curl -sf "http://127.0.0.1:18096/api/v1/runs/$RID" | python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])')
  if [[ "$ST" == "COMPLETED" ]]; then
    echo "OK run=$RID status=COMPLETED (bilibili hot session path)"
    exit 0
  fi
  if [[ "$ST" == "FAILED" || "$ST" == "ABORTED" ]]; then
    curl -sf "http://127.0.0.1:18096/api/v1/runs/$RID" >&2
    exit 1
  fi
  sleep 0.25
done
echo timeout >&2
exit 1
