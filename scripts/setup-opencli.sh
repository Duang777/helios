#!/usr/bin/env bash
# Install / repair OpenCLI for Helios Slice P/Q.
# Automates npm CLI + extension zip download; Chrome Web Store click is still required once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${PATH:-/usr/bin:/bin}"
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

EXT_DIR="${HELIOS_OPENCLI_EXT_DIR:-$ROOT/.helios-dev/opencli-extension}"
OPENCLI_PKG="${HELIOS_OPENCLI_PKG:-@jackwener/opencli@1.8.6}"
WAIT_SEC="${HELIOS_OPENCLI_WAIT_SEC:-120}"

echo "==> 1) Install OpenCLI CLI ($OPENCLI_PKG)"
npm i -g "$OPENCLI_PKG"
command -v opencli >/dev/null
opencli --version

echo
echo "==> 2) Download Browser Bridge extension (manual Load unpacked fallback)"
mkdir -p "$(dirname "$EXT_DIR")"
ASSET=$(gh api repos/jackwener/opencli/releases/latest --jq '.assets[] | select(.name|test("extension";"i")) | .browser_download_url' | head -1)
if [[ -z "$ASSET" ]]; then
  echo "WARN: could not resolve extension asset via gh; skip zip download"
else
  TMP=$(mktemp)
  curl -fsSL -o "$TMP" "$ASSET"
  rm -rf "$EXT_DIR"
  mkdir -p "$EXT_DIR"
  unzip -qo "$TMP" -d "$EXT_DIR"
  rm -f "$TMP"
  echo "Extension unpacked at: $EXT_DIR"
  echo "  (manifest: $EXT_DIR/manifest.json)"
fi

echo
echo "==> 3) Open Chrome install surfaces (you must click Install / enable)"
STORE="https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk"
open "$STORE" 2>/dev/null || true
open "chrome://extensions" 2>/dev/null || true
echo "Preferred: install from Chrome Web Store (opened)."
echo "Fallback: chrome://extensions → Developer mode → Load unpacked →"
echo "          $EXT_DIR"

echo
echo "==> 4) Build helios-opencli into ~/.helios/bin"
BIN_DIR="${HELIOS_BIN_DIR:-$HOME/.helios/bin}"
mkdir -p "$BIN_DIR"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
fi
(
  cd "$ROOT/backend"
  go build -o "$BIN_DIR/helios-opencli" ./cmd/helios-opencli
)
echo "Built: $BIN_DIR/helios-opencli"
"$BIN_DIR/helios-opencli" introspect | python3 -c 'import json,sys; d=json.load(sys.stdin); print("introspect", d["name"], d["version"])'

echo
echo "==> 5) Wait for Browser Bridge (doctor OK), up to ${WAIT_SEC}s"
deadline=$((SECONDS + WAIT_SEC))
ok=0
while (( SECONDS < deadline )); do
  if opencli doctor 2>&1 | tee /tmp/helios-opencli-doctor.txt | grep -q '\[OK\] Connectivity'; then
    ok=1
    break
  fi
  sleep 3
done

if [[ "$ok" -eq 1 ]]; then
  echo "Bridge OK."
  cat /tmp/helios-opencli-doctor.txt
  echo
  echo "==> 6) Probe bilibili hot (session path)"
  if opencli bilibili hot --limit 2 -f json >/tmp/helios-bili-hot.json 2>/tmp/helios-bili-hot.err; then
    python3 -c 'import json; d=json.load(open("/tmp/helios-bili-hot.json")); print("bilibili hot ok, n=", len(d) if isinstance(d,list) else type(d))'
  else
    echo "WARN: bilibili hot failed (may need login in Chrome on bilibili.com)"
    cat /tmp/helios-bili-hot.err || true
    echo "Optional: opencli bilibili login"
  fi
  echo
  echo "Done. Next:"
  echo "  ./scripts/dev-api.sh"
  echo "  ./scripts/register-opencli.sh"
  echo "  HELIOS_OPENCLI_REQUIRE_SESSION=1 ./scripts/smoke-opencli-session.sh"
  exit 0
fi

echo
echo "STILL WAITING: Browser Bridge not connected."
echo "Please finish Chrome install, then re-run:"
echo "  ./scripts/setup-opencli.sh"
echo "Or check: opencli doctor"
exit 2
