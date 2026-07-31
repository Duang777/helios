# Helios GUI Operator

Local browser escalation sidecar for `uses: gui` steps. Design: `docs/architecture/slice-e-gui.md`.

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
- `POST /v1/actions/screenshot_and_confirm` `{url, selector?}` → `{ok, screenshotBase64, contentType, mode}`
- Primitive: `/v1/open`, `/v1/click`, `/v1/type`, `/v1/extract`, `/v1/screenshot`
- `POST /v1/human_help/start` `{reason?, url?}` → `{helpId, status, viewerUrl, sessionId, mode}`
- `GET /v1/human_help/:id/viewer` — handoff HTML (screenshot refresh + 完成/放弃)
- `GET /v1/human_help/:id/shot` — PNG base64
- `POST /v1/human_help` long-poll until resolve
- `POST /v1/human_help/resolve` `{helpId, ok, note?}`

Go connects via `HELIOS_GUI_OPERATOR_URL` (default `http://127.0.0.1:8792`).
