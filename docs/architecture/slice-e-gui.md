# Slice E — GUI Escalation Design

Status: Accepted (implemented 2026-07-31)
Date: 2026-07-31  
Parent: `docs/architecture/implementation-design-v0.1.md` §10, PRD F-G1/F-G2/F-G4

## Goal

When a CLI step signals escalation (`needs_gui: true`), Helios runs a gated `uses: gui` step against a local GUI operator, stores screenshot evidence, and continues the run. Selectors live in the workflow artifact — not inventing clicks at runtime.

## Non-goals (this slice)

- Full browser agent / LLM-driven clicking
- Pixel-perfect replay
- Production multi-tenant browser farms
- Complete `human_help` UX polish (browser-side assist UI); API + console resolve are done

## Architecture

```text
demo-erp po create ──► { needs_gui, confirmUrl }
        │
        ▼
workflow when: "${po.data.needs_gui} == true"
        │
        ▼
Go runtime runGUI ──HTTP──► packages/gui-operator
        │                         │
        │                         ├ fake: synthetic PNG
        │                         └ playwright: open → screenshot → optional click
        ▼
evidence.WriteGUI → {seq}-{stepId}.png + .json
```

## Contracts

### Workflow step

```yaml
- id: gui_confirm
  uses: gui
  needs: [create_po]
  when: "${po.data.needs_gui} == true"
  action: screenshot_and_confirm   # required for Slice E
  sideEffect: write
  gui:
    url: "${po.data.confirmUrl}"   # required; CLI envelope nests under .data
    selector: "button#confirm"     # optional
  out: gui_result
```

Schema deepen (structural):

- `uses: gui` ⇒ `action` required; `gui.url` required (string, may be `${...}`)
- Supported actions in E: `screenshot_and_confirm` only (others rejected at runtime with clear error)

### Operator HTTP (`packages/gui-operator`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | — | `{status, service, mode}` |
| POST | `/v1/actions/screenshot_and_confirm` | `{url, selector?}` | `{ok, screenshotBase64, contentType, mode, sessionId?}` |
| POST | `/v1/open` | `{url}` | `{sessionId}` |
| POST | `/v1/screenshot` | `{sessionId}` | `{screenshotBase64, contentType}` |
| POST | `/v1/click` | `{sessionId, selector}` | `{ok}` |
| POST | `/v1/type` | `{sessionId, selector, text}` | `{ok}` |
| POST | `/v1/extract` | `{sessionId, selector}` | `{text}` |
| POST | `/v1/human_help/start` | `{reason?}` | `{helpId, status: waiting, mode}` |
| POST | `/v1/human_help` | `{helpId?, reason?, timeoutMs?}` | long-poll until resolve / timeout |
| POST | `/v1/human_help/resolve` | `{helpId, ok, note?}` | `{ok, helpId}` |

Default listen: `http://127.0.0.1:8792`  
Env: `HELIOS_GUI_PORT`, `HELIOS_GUI_MODE=playwright|fake` (**default `playwright`**)

### Go `guiclient`

Mirrors `pi.Client`:

- `ScreenshotAndConfirm(ctx, url, selector) (Result, error)`
- Result: `OK`, `Screenshot []byte`, `ContentType`, `Mode`
- Env wiring: `HELIOS_GUI_OPERATOR_URL` (default `http://127.0.0.1:8792`)

### Evidence

Extend `domain.Evidence` with:

```go
ScreenshotRef string `json:"screenshotRef,omitempty"`
```

`evidence.Store.WriteGUI(ev, png []byte)` writes:

- `evidence/{seq}-{stepId}.png`
- `evidence/{seq}-{stepId}.json` (meta; `StdoutRef` unused; `ScreenshotRef` set)

Step output: `{ok: true, screenshotPath: "<rel>", mode: "fake|playwright"}`

### demo-erp escalation signal

`po create` may return:

```json
{
  "needs_gui": true,
  "confirmUrl": "http://127.0.0.1:8792/fixture/confirm.html",
  ...
}
```

Triggers:

- Flag `--needs-gui` on `po create`, **or**
- Env `DEMO_ERP_NEEDS_GUI=1`

`confirmUrl` defaults to operator fixture page when needs_gui is true; override with `--confirm-url <url>`.

## Modes

| Mode | When | Behavior |
|------|------|----------|
| `playwright` | **default** / smoke | Chromium opens URL, screenshot, optional click |
| `fake` | unit tests / no browser | Fixed small PNG; exercises Go path without Playwright |

`confirmUrl` defaults to `{HELIOS_GUI_OPERATOR_URL}/fixture/confirm.html` when `needs_gui` is true.

## Demo workflow

`workflows/demo.lead-sync-gui.yaml`: same as lead-sync, plus gated `gui_confirm` after `create_po`.  
Smoke: `scripts/smoke-lead-sync-gui.sh` defaults to **playwright**, asserts PNG **>500** bytes.

## human_help

- Workflow: `uses: gui`, `action: human_help`, optional `prompt` / `gui.reason`
- Runtime sets `WAITING_HUMAN`, notifies operator via `/v1/human_help/start`
- Unblock: `POST /api/v1/runs/{runId}/human-help` `{stepId, ok, note?}` (console button mirrors this)

## Security / principles

- Selectors only from YAML (`F-G4`)
- Short HTTP timeouts on guiclient (default 30s)
- No arbitrary JS eval API in Slice E
- Screenshots are evidence artifacts, not secrets; still run through path under runDir only
- Operator binds localhost by default

## Acceptance

1. `go test ./internal/evidence ./internal/guiclient ./internal/runtime ./internal/schema` pass
2. Playwright smoke: `./scripts/smoke-lead-sync-gui.sh` COMPLETED with PNG >500 bytes
3. With `needs_gui=false`, `gui_confirm` is `SKIPPED`
4. `human_help` blocks until `/human-help` resolve
5. Docs: this file + `docs/architecture/real-path-defaults.md`

## Follow-ups (not blocking E)

- Console evidence viewer for PNG
- Richer browser-side human assist UI
