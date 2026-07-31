# Pi Sidecar

HTTP compile + AI-step assist for Helios, powered by [Pi](https://pi.dev/) (`@earendil-works/pi-coding-agent`).

Design: `docs/architecture/slice-c-d-pi.md` · Slice J: `docs/architecture/slice-j-pi-live-default.md`

## Modes

| `HELIOS_PI_MODE` | Behavior |
|---|---|
| unset | **auto**: live if auth env present, else mock (Slice J) |
| `mock` | Deterministic templates / JSON — offline tests / CI |
| `live` | Real Pi session with **`noTools: "all"`** (no bash) |

Sources: [Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [Providers](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).

## Auth (required for live)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or Helios override
export HELIOS_PI_PROVIDER=anthropic
export HELIOS_PI_API_KEY=sk-ant-...
export HELIOS_PI_MODEL=anthropic/claude-sonnet-4-5
```

### CFMax (OpenAI-compatible)

```bash
./scripts/setup-cfmax-pi.sh   # models.json + User-Agent override (CFMax blocks OpenAI/JS UA)
./scripts/dev-pi-sidecar-live.sh
```

## Run

```bash
./scripts/dev-pi-sidecar.sh          # auto mode; sources .helios-dev/pi-live.env when present
HELIOS_PI_MODE=mock ./scripts/dev-pi-sidecar.sh   # force offline
./scripts/dev-pi-sidecar-live.sh     # live via .helios-dev/pi-live.env
```

Endpoints:

- `GET /health` → `{status, service, mode, modeExplicit, authConfigured, provider?, model?}`
- `POST /compile` `{intent, clis, previousYAML?, previousErrors?, hints?}` → `{yaml, mode, model?, rawTraceId}`
- `POST /ai-step` `{prompt, input, outputSchema?, model?}` → `{json, mode, model?, rawTraceId}`

Go API: `HELIOS_PI_SIDECAR_URL` (default `http://127.0.0.1:8091`), optional `HELIOS_PI_HTTP_TIMEOUT`.

## Acceptance

```bash
cd packages/pi-sidecar && npm test
./scripts/smoke-compile.sh
./scripts/smoke-compile-live.sh   # SKIP without key; live when key present
./scripts/smoke-lead-sync-ai.sh
```
