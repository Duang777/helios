# Agent Guide

## Product Direction

Build `Helios`, a business workflow compiler and auditable runtime:

- Natural language compiles into reusable workflow artifacts (YAML / code).
- Execution prefers business platform CLIs; GUI is escalation only.
- AI kernel is Pi (sidecar/RPC). Go owns compile validation, scheduling, approvals, evidence, and CLI process control.
- Do not fork Eko. Do not treat current repo code as binding; rebuild against the PRD is allowed.
- Use `SKUFlow` only later as an industry shell, not the kernel definition.

## Source of Truth

- PRD: `docs/prd/helios-prd-v0.1.md`
- Research: `docs/research/2026-07-31-helios-reposition-research.md`
- Implementation design: `docs/architecture/implementation-design-v0.1.md`
- Slice E (GUI): `docs/architecture/slice-e-gui.md`
- Slice C/D (Pi): `docs/architecture/slice-c-d-pi.md`
- Slice F (CLI factory): `docs/architecture/slice-f-cli-factory.md`
- Real-path defaults: `docs/architecture/real-path-defaults.md`
- Reuse map: `docs/research/2026-08-01-reuse-oss-by-module.md`
- Best-fit picks: `docs/research/2026-08-01-best-fit-oss.md`
- **Dev gate (必读):** `docs/architecture/dev-gate.md` — 无 Accepted 切片设计不得实现
- Slice G (Lathe, Implemented): `docs/architecture/slice-g-lathe-adapter.md`
- Slice H (human_help handoff, Implemented): `docs/architecture/slice-h-human-help-handoff.md`
- Slice I (Feishu thicken, Implemented): `docs/architecture/slice-i-feishu-thicken.md` / `docs/feishu-cli.md`
- Plan/tasks: `tasks/plan.md`, `tasks/todo.md`
- ADR: `docs/decisions/ADR-001-go-control-plane-pi-sidecar.md`
- Naming: `docs/naming.md`

## Current Plan

1. ~~Review and lock PRD open questions (especially first real platform/playbook).~~ Slice A uses demo CLIs.
2. ~~Freeze Workflow schema v1 and CLI contract v1.~~
3. ~~Implement Go runtime slice (validate → cli-run → evidence) before UI polish.~~ Slice A done.
4. ~~Add minimal console against `/api/v1` (Slice B).~~
5. ~~Add Pi sidecar for compile assist (Slice C).~~ Hardened: `docs/architecture/slice-c-d-pi.md`
6. ~~Add `uses: ai`, Manifest publish, `run_workflow` (Slice D).~~ Closed demo + evidence mode/model.
7. ~~Add GUI escalation (Slice E).~~ Design + impl: `docs/architecture/slice-e-gui.md`
8. ~~Add CLI factory (Slice F).~~ Design + impl: `docs/architecture/slice-f-cli-factory.md`
9. ~~**Slice G Lathe adapter**~~ — Implemented: `docs/architecture/slice-g-lathe-adapter.md` / ADR-002
10. ~~**Slice H human_help handoff**~~ — Implemented: `docs/architecture/slice-h-human-help-handoff.md`
11. ~~**Slice I Feishu thicken**~~ — Implemented: `docs/architecture/slice-i-feishu-thicken.md`

## Development Gate

See `docs/architecture/dev-gate.md`.

1. Write / update slice tech design (`Proposed`)
2. Human marks `Accepted` (or says「按该文档实现」)
3. Agent Reads Required skills → implements in thin increments with tests
4. Acceptance commands green → Status `Implemented`

Template: `docs/architecture/_templates/slice-tech-design.md`

## Slice A verification

```bash
cd backend && go test ./...
./scripts/smoke-lead-sync.sh
```

## Slice B verification

```bash
./scripts/dev-api.sh          # terminal 1: API + demo CLIs
cd web && npm run dev         # terminal 2: console
```

In the console: validate → save → run → approve → inspect evidence.

## Slice C verification

```bash
./scripts/dev-pi-sidecar.sh   # terminal 1: mock pi-sidecar :8091
./scripts/dev-api.sh          # terminal 2: API (HELIOS_PI_SIDECAR_URL defaults to :8091)
./scripts/smoke-compile.sh
cd web && npm run dev         # terminal 3: Intent → 编译
```

Live Pi (requires provider auth):

```bash
# Option A: public providers
export ANTHROPIC_API_KEY=...
HELIOS_PI_MODE=live ./scripts/dev-pi-sidecar.sh

# Option B: CFMax OpenAI-compatible gateway (keychain + models.json)
./scripts/setup-cfmax-pi.sh      # User-Agent override required (CFMax blocks OpenAI/JS UA)
./scripts/dev-pi-sidecar-live.sh # reads .helios-dev/pi-live.env → CFMAX_API_KEY from keychain
```

## Slice D verification

```bash
./scripts/dev-pi-sidecar.sh
./scripts/dev-api.sh
# register demo CLIs, then:
./scripts/smoke-run-workflow.sh
```

Skill: `skills/helios-run-workflow/SKILL.md`

## Slice C/D verification

Design: `docs/architecture/slice-c-d-pi.md`

```bash
./scripts/smoke-compile.sh
./scripts/smoke-lead-sync-ai.sh
cd packages/pi-sidecar && npm test
```

Live (optional): `./scripts/setup-cfmax-pi.sh` then `./scripts/dev-pi-sidecar-live.sh`

## Slice E verification

Design: `docs/architecture/slice-e-gui.md`  
Defaults: Playwright (not fake). See `docs/architecture/real-path-defaults.md`.

```bash
./scripts/smoke-lead-sync-gui.sh          # playwright + PNG >500B
# offline unit only:
HELIOS_GUI_MODE=fake ./scripts/dev-gui-operator.sh
```

## Slice F verification

Design: `docs/architecture/slice-f-cli-factory.md`  
Defaults: HTTP CLI + `demo-inventory-api` (not FileDB).

```bash
cd backend && go test ./internal/clifactory/
./scripts/smoke-cli-factory.sh
```

## Slice G verification (Lathe)

Design: `docs/architecture/slice-g-lathe-adapter.md` / ADR-002

```bash
go install github.com/lathe-cli/lathe/cmd/lathe@v0.5.2
cd backend && go test ./internal/clifactory/...
./scripts/smoke-cli-factory-lathe.sh
```

## Slice H verification (human_help handoff)

Design: `docs/architecture/slice-h-human-help-handoff.md`

```bash
cd packages/gui-operator && npm test
./scripts/smoke-human-help.sh
# real browser session:
HELIOS_GUI_MODE=playwright ./scripts/smoke-human-help.sh
```

## Slice I verification (Feishu thicken)

Design: `docs/architecture/slice-i-feishu-thicken.md`  
Guide: `docs/feishu-cli.md`

```bash
cd backend && go test ./internal/schema/ ./internal/registry/
./scripts/smoke-feishu-lark.sh
# after login: console run feishu.calendar-agenda / feishu.chat-list
```

## Coding Standards

- Prefer small, contract-first changes.
- Keep backend domain types in `backend/internal/domain` when using the Go tree.
- Keep HTTP validation at API boundaries.
- Runtime CLI/approval paths should be deterministic; Pi is only for compile assist and explicit `ai` nodes.
- Use scoped agent context per AI node. Do not introduce global prompt state as source of truth.
- For UI, build the tool surface directly. Avoid landing-page treatment.
- Prefer shadcn/Base UI components for frontend surfaces. When a new UI component is needed, run `pnpm ui:add <component>` from the repository root instead of hand-rolling a local replacement.
- When feedback says the frontend is ugly, treat it as a product-fit failure, not a palette issue.

## Skills Used

- `api-and-interface-design` for REST and module contracts.
- `frontend-ui-engineering` for the operation console.
- `incremental-implementation` for thin implementation slices.
- `test-driven-development` for compiler/runtime behavior.
- `git-workflow-and-versioning` for change discipline.
- `spec-driven-development` / `documentation-and-adrs` for PRD and ADRs.

## External References

- `FellouAI/eko`: architecture reference only (plan/execute, pause, deps). No code copy.
- `earendil-works/pi`: AI kernel via RPC/sidecar.
- CLI contract references: ACLI, agent-ready, Lathe, FuseCLI (evaluate license before reuse).
- `Nutlope/hallmark`: MIT, product/design quality inspiration only.
- `birobirobiro/awesome-shadcn-ui`: frontend component discovery index.
- `nolly-studio/cult-ui`: motion/AI UI reference after license checks.

Do not copy code from reference repositories into this project without attribution and license confirmation.
