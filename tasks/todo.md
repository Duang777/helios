# Helios Tasks

- [x] Task: Freeze `contracts/workflow.schema.json` and `cli-introspect.schema.json`
  - Acceptance: Both schemas validate the examples in the implementation design
  - Verify: schema unit tests with valid/invalid fixtures
  - Files: `contracts/`, `backend/internal/schema/`

- [x] Task: Implement new domain types + expr interpolator
  - Acceptance: `${params.x}` and `${out.field}` work; cycle detection helper exists
  - Verify: `go test ./internal/expr ./internal/domain`
  - Files: `backend/internal/domain/`, `backend/internal/expr/`

- [x] Task: Build `demo-crm` and `demo-erp` CLIs with introspect/json/dry-run
  - Acceptance: Commands match demo.lead-sync needs; exit code 9 for dry-run success
  - Verify: CLI golden tests
  - Files: `backend/cmd/demo-crm/`, `backend/cmd/demo-erp/`

- [x] Task: CLI registry + allowlisted clirunner
  - Acceptance: Unregistered CLI or unknown subcommand is rejected; capture/truncation/redaction work
  - Verify: `go test ./internal/registry ./internal/clirunner`
  - Files: `backend/internal/registry/`, `backend/internal/clirunner/`

- [x] Task: Runtime DAG for cli + approval + evidence fs store
  - Acceptance: demo workflow runs end-to-end in-process with fake approval injection
  - Verify: `go test ./internal/runtime ./internal/evidence`
  - Files: `backend/internal/runtime/`, `backend/internal/evidence/`, `backend/internal/store/`

- [x] Task: HTTP API for validate/save/run/approve/evidence/clis
  - Acceptance: curl script runs demo.lead-sync through WAITING_APPROVAL to COMPLETED
  - Verify: `go test ./internal/httpapi` + `scripts/smoke-lead-sync.sh`
  - Files: `backend/internal/httpapi/`, `backend/cmd/helios/`, `workflows/demo.lead-sync.yaml`

- [x] Task: Minimal console wired to new API
  - Acceptance: compile-later optional; run/approve/evidence usable
  - Verify: manual check
  - Files: `web/src/**`, `web/src/api/types.ts`

- [x] Task: Pi sidecar compile endpoint + Go compile client
  - Acceptance: intent → yaml → validate loop; tool allowlist restricted
  - Verify: mocked sidecar tests
  - Files: `packages/pi-sidecar/`, `backend/internal/pi/`, `backend/internal/compile/`

- [x] Task: AI step + manifest publish + run_workflow skill
  - Acceptance: published workflow callable with params only from manifest
  - Verify: integration test
  - Files: `packages/pi-sidecar/`, `skills/` or docs skill path, API publish

- [x] Task: Slice E — Evidence WriteGUI + demo-erp needs_gui
  - Acceptance: WriteGUI stores png+json; po create can return needs_gui+confirmUrl
  - Verify: `go test ./internal/evidence`; demo-erp flag/env unit path
  - Files: `backend/internal/evidence/`, `backend/internal/domain/`, `backend/cmd/demo-erp/`
  - Design: `docs/architecture/slice-e-gui.md`

- [x] Task: Slice E — gui-operator package
  - Acceptance: fake mode `/v1/actions/screenshot_and_confirm`; playwright optional
  - Verify: node test + health curl
  - Files: `packages/gui-operator/`, `pnpm-workspace.yaml`

- [x] Task: Slice E — guiclient + runtime runGUI
  - Acceptance: uses:gui runs when when=true; SKIPPED when false; evidence has ScreenshotRef
  - Verify: `go test ./internal/guiclient ./internal/runtime`
  - Files: `backend/internal/guiclient/`, `backend/internal/runtime/`, `backend/cmd/helios/`

- [x] Task: Slice E — workflow + schema + smoke
  - Acceptance: demo.lead-sync-gui completes with png evidence under DEMO_ERP_NEEDS_GUI=1
  - Verify: `scripts/smoke-lead-sync-gui.sh`
  - Files: `workflows/demo.lead-sync-gui.yaml`, `contracts/`, `scripts/`


- [x] Task: Pi hardening (Slice C/D quality bar)
  - Acceptance: design doc; live repair includes previousYAML; demo AI consumes poDraft; self-contained smokes; evidence mode/model; no Go blind retry
  - Verify: `cd packages/pi-sidecar && npm test`; `./scripts/smoke-compile.sh`; `./scripts/smoke-lead-sync-ai.sh`
  - Design: `docs/architecture/slice-c-d-pi.md`

- [x] Task: CLI factory (Slice F)
  - Acceptance: OpenAPI/factory spec → Go CLI with introspect; registers; workflow smoke
  - Verify: `go test ./internal/clifactory`; `./scripts/smoke-cli-factory.sh`
  - Files: `backend/internal/clifactory/`, `backend/cmd/helios-factory/`, `backend/cmd/demo-inventory/`, `examples/cli-factory/`
  - Design: `docs/architecture/slice-f-cli-factory.md`

- [ ] Task: Dev gate — tech design before code (process)
  - Acceptance: `docs/architecture/dev-gate.md` + template + Cursor rule; agent/CLAUDE aligned
  - Design: `docs/architecture/dev-gate.md`

- [x] Task: Lathe adapter (Slice G)
  - Design: `docs/architecture/slice-g-lathe-adapter.md` / ADR-002
  - Acceptance: `helios-factory --engine=lathe` + introspect wrapper; tests/smoke
  - Verify: `go test ./internal/clifactory/...`; `./scripts/smoke-cli-factory-lathe.sh`
  - Files: `backend/internal/clifactory/latheadapt/`, `backend/cmd/helios-factory/`

- [x] Task: human_help session handoff (Slice H)
  - Design: `docs/architecture/slice-h-human-help-handoff.md`
  - Acceptance: viewerUrl + smoke-human-help; console link
  - Verify: `cd packages/gui-operator && npm test`; `./scripts/smoke-human-help.sh`
  - Files: `packages/gui-operator/`, `backend/internal/guiclient/`, `backend/internal/runtime/`, `web/src/App.tsx`, `workflows/demo.human-help.yaml`
