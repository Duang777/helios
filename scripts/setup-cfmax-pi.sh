#!/usr/bin/env bash
# Install CFMax provider into ~/.pi/agent/models.json for Helios live Pi.
# CFMax WAF blocks OpenAI Node SDK User-Agent ("OpenAI/JS …"); override is required.
set -euo pipefail

MODELS_JSON="${PI_MODELS_JSON:-$HOME/.pi/agent/models.json}"
mkdir -p "$(dirname "$MODELS_JSON")"

python3 - "$MODELS_JSON" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text()) if path.exists() else {"providers": {}}
providers = data.setdefault("providers", {})

providers["cfmax"] = {
    "baseUrl": "https://api-cfmax.codezsy.com/v1",
    "api": "openai-completions",
    "apiKey": "$CFMAX_API_KEY",
    "authHeader": True,
    "headers": {
        # Required: CFMax returns 403 "Your request was blocked." for OpenAI/JS UA.
        "User-Agent": "helios-pi-sidecar/0.1",
    },
    "compat": {
        "supportsDeveloperRole": False,
        "supportsReasoningEffort": False,
        "supportsUsageInStreaming": False,
    },
    "models": [
        {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.4", "name": "GPT-5.4 (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.5", "name": "GPT-5.5 (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.6-luna", "name": "GPT-5.6 Luna (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.6-sol", "name": "GPT-5.6 Sol (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.6-terra", "name": "GPT-5.6 Terra (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "gpt-5.3-codex-spark", "name": "GPT-5.3 Codex Spark (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
        {"id": "codex-auto-review", "name": "Codex Auto Review (CFMax)", "reasoning": False, "input": ["text"], "contextWindow": 128000, "maxTokens": 16384, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}},
    ],
}

path.write_text(json.dumps(data, indent=2) + "\n")
print(f"wrote cfmax provider -> {path}")
PY

echo "Next:"
echo "  security add-generic-password -a helios -s helios-cfmax-api-key -w '<key>' -U"
echo "  ./scripts/dev-pi-sidecar-live.sh"
