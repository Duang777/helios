# Helios GUI Operator

Local browser escalation sidecar for `uses: gui` steps.

Design: `docs/architecture/slice-e-gui.md` · Slice L: `docs/architecture/slice-l-gui-playwright-cli.md`

## Modes

| `HELIOS_GUI_MODE` | Behavior |
|---|---|
| `playwright` (**default**) | Opens URL with Playwright Chromium, screenshot, optional click. |
| `fake` | No Chromium; returns a tiny PNG. For unit tests only. |

## Run

```bash
./scripts/dev-gui-operator.sh
# or
cd packages/gui-operator && HELIOS_GUI_MODE=playwright HELIOS_GUI_PORT=8792 npm start
```

## Endpoints

- `GET /health`
- `GET /fixture/confirm.html` — demo confirm page
- `GET /fixture/form.html` — demo form (fill / check / submit)
- `POST /v1/actions/screenshot_and_confirm` `{url, selector?}` → `{ok, screenshotBase64, contentType, mode}`
- `POST /v1/actions/run` `{steps:[{op, ...}]}` — playwright-cli-shaped multi-step (CSS selectors)
- Primitive (aligned with playwright-cli Core):  
  `/v1/open` `/v1/goto` `/v1/click` `/v1/fill` `/v1/type` `/v1/press` `/v1/hover` `/v1/select` `/v1/check` `/v1/uncheck` `/v1/extract` `/v1/screenshot`
- `POST /v1/human_help/start` `{reason?, url?}` → `{helpId, status, viewerUrl, sessionId, mode}`
- `GET /v1/human_help/:id/viewer` — handoff HTML (screenshot refresh + 完成/放弃)
- `GET /v1/human_help/:id/shot` — PNG base64
- `POST /v1/human_help` long-poll until resolve
- `POST /v1/human_help/resolve` `{helpId, ok, note?}`

Selectors in workflows are **CSS / Playwright selectors** (not playwright-cli a11y refs), so artifacts stay reproducible.

Go connects via `HELIOS_GUI_OPERATOR_URL` (default `http://127.0.0.1:8792`).

## Acceptance

```bash
cd packages/gui-operator && npm test
./scripts/smoke-gui-run.sh
HELIOS_GUI_MODE=playwright ./scripts/smoke-gui-run.sh
```
