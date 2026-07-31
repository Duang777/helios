#!/usr/bin/env bash
# Slice O — MVP §15 acceptance aggregator (core subset).
# Optional: HELIOS_MVP_FULL=1 adds GUI / Feishu mock smokes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${PATH:-/usr/bin:/bin}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
if [[ -x "$HOME/.local/share/mise/installs/go/1.26.1/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26.1/bin:$PATH"
elif [[ -x "$HOME/.local/share/mise/installs/go/1.26/bin/go" ]]; then
  export PATH="$HOME/.local/share/mise/installs/go/1.26/bin:$PATH"
fi
if [[ -x "$HOME/.local/share/mise/installs/node/lts/bin/node" ]]; then
  export PATH="$HOME/.local/share/mise/installs/node/lts/bin:$PATH"
fi

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

run_step() {
  local name="$1"
  shift
  echo ""
  echo "=== $name ==="
  "$@" || fail "$name"
  ok "$name"
}

[[ -f "$ROOT/docs/architecture/slice-o-mvp-acceptance.md" ]] || fail "missing slice-o design"
[[ -f "$ROOT/docs/acceptance/2026-08-01-feishu-live.md" ]] || fail "missing feishu live acceptance record"

run_step "go schema+runtime+httpapi" bash -c "cd \"$ROOT/backend\" && go test ./internal/schema/ ./internal/runtime/ ./internal/httpapi/"
run_step "smoke-compile" "$ROOT/scripts/smoke-compile.sh"
run_step "smoke-lead-sync" "$ROOT/scripts/smoke-lead-sync.sh"
run_step "smoke-lead-sync-ai" "$ROOT/scripts/smoke-lead-sync-ai.sh"

run_step "prd-§15+nongoals" env ROOT="$ROOT" python3 - <<'PY'
from pathlib import Path
import os
root = Path(os.environ["ROOT"])
prd = (root / "docs/prd/helios-prd-v0.1.md").read_text(encoding="utf-8")
agent = (root / "agent.md").read_text(encoding="utf-8")
assert "非目标（明确不做）" in prd
assert "替换 Temporal" in prd
assert "拖拽编辑器" in prd
assert "fork Eko" in agent
assert "SKUFlow" in agent
prd15 = prd.split("## 15. 验收检查清单")[1].split("## 16.")[0]
unchecked = [ln for ln in prd15.splitlines() if ln.strip().startswith("- [ ]")]
if unchecked:
    raise SystemExit("PRD §15 still has unchecked items:\n" + "\n".join(unchecked))
print("PRD §15 fully checked; non-goals intact")
PY

if [[ "${HELIOS_MVP_FULL:-}" == "1" ]]; then
  run_step "smoke-feishu-daily-brief" "$ROOT/scripts/smoke-feishu-daily-brief.sh"
  run_step "smoke-gui-run-fake" env HELIOS_GUI_MODE=fake "$ROOT/scripts/smoke-gui-run.sh"
fi

echo ""
echo "MVP §15 acceptance GREEN (core)"
