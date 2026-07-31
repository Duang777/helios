# Helios Real Path Defaults

Status: Active  
Date: 2026-08-01

## Rule

**Default = real path.** Mock / fake / FileDB are explicit offline fallbacks for unit tests and air-gapped CI — not the product demo.

| Area | Default | Offline fallback | Env |
|------|---------|------------------|-----|
| Pi sidecar | `live` (when key present) | `mock` | `HELIOS_PI_MODE` |
| GUI operator | `playwright` | `fake` | `HELIOS_GUI_MODE` |
| CLI factory | HTTP client + OpenAPI `servers` (`engine=helios`) or **Lathe** (`engine=lathe`) | FileDB `store*` | `baseUrl` / `{NAME}_BASE_URL` / install `lathe` |
| Feishu | real Lark API via approval | — | Feishu credentials |
| human_help | blocking `WAITING_HUMAN` + viewerUrl + resolve API | — | — |

## Acceptance (do not pass on mock alone)

```bash
# Playwright screenshot evidence (>500 bytes PNG)
./scripts/smoke-lead-sync-gui.sh

# HTTP inventory API + factory-generated CLI
./scripts/smoke-cli-factory.sh

# Live Pi (gated; needs CFMax / provider key — skips cleanly without)
./scripts/smoke-compile-live.sh
```

## Reuse

- GUI: Playwright (Chromium)
- Factory HTTP: OpenAPI `servers` → generated `net/http` client (same envelope as democli)
- Factory Lathe: `helios-factory --engine=lathe` → Lathe Cobra + Helios introspect wrapper (ADR-002)
- Inventory demo API: `backend/cmd/demo-inventory-api` matching the OpenAPI doc
