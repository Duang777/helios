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
- Slice J (Pi live default, Implemented): `docs/architecture/slice-j-pi-live-default.md`
- Slice K (evidence viewer, Implemented): `docs/architecture/slice-k-evidence-viewer.md`
- Slice L (GUI ↔ playwright-cli, Implemented): `docs/architecture/slice-l-gui-playwright-cli.md`
- Slice M (Feishu daily-brief / Q1, Implemented): `docs/architecture/slice-m-feishu-daily-brief.md`
- Slice N (live compile harden, Implemented): `docs/architecture/slice-n-live-compile-harden.md`
- Slice O (MVP §15 closeout, Implemented): `docs/architecture/slice-o-mvp-acceptance.md`
- Slice P (OpenCLI adapter, Implemented): `docs/architecture/slice-p-opencli-adapter.md` / `docs/opencli.md`
- Slice Q (OpenCLI session read, Implemented): `docs/architecture/slice-q-opencli-session-read.md`
- Slice R (console usability, Implemented): `docs/architecture/slice-r-console-usability.md`
- Slice S (business chat shell, In progress): `docs/architecture/slice-s-business-chat-shell.md` — `web-business/`（assistant-ui clone + NL 卡片）
- Slice T (desktop shell, Implemented): `docs/architecture/slice-t-desktop-proma-shell.md` — `desktop/`（AGPL 见 ADR-004）
- Slice V (desktop NL compile loop, Implemented): `docs/architecture/slice-v-desktop-nl-compile-loop.md` — 桌面 compile→确认→保存→运行
- Feishu live accept: `docs/acceptance/2026-08-01-feishu-live.md`
- Plan/tasks: `tasks/plan.md`, `tasks/todo.md`
- ADR: `docs/decisions/ADR-001-go-control-plane-pi-sidecar.md`
- ADR-003 (Q2–Q5 freeze): `docs/decisions/ADR-003-mvp-open-questions-q2-q5.md`
- ADR-004 (desktop shell license): `docs/decisions/ADR-004-proma-agpl-desktop-shell.md`
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
12. ~~**Slice J Pi live default**~~ — Implemented: `docs/architecture/slice-j-pi-live-default.md`
13. ~~**Slice K evidence viewer**~~ — Implemented: `docs/architecture/slice-k-evidence-viewer.md`
14. ~~**Slice L GUI playwright-cli align**~~ — Implemented: `docs/architecture/slice-l-gui-playwright-cli.md`
15. ~~**Slice M Feishu daily-brief (Q1)**~~ — Implemented: `docs/architecture/slice-m-feishu-daily-brief.md`
16. ~~**Slice N live compile harden**~~ — Implemented: `docs/architecture/slice-n-live-compile-harden.md`
17. ~~**Slice O MVP §15 closeout**~~ — Implemented: `docs/architecture/slice-o-mvp-acceptance.md`
18. ~~**ADR-003 freeze Q2–Q5**~~ — Accepted: YAML DAG+契约 / TS 实现与工具链（非双主语言）/ Pi sidecar / fs evidence / local；**Q6 still open**
19. ~~**Slice P OpenCLI adapter**~~ — Implemented: `docs/architecture/slice-p-opencli-adapter.md`
20. ~~**Slice Q OpenCLI session read**~~ — Implemented: `docs/architecture/slice-q-opencli-session-read.md`（bilibili hot）
21. ~~**Slice R console usability**~~ — Implemented: `docs/architecture/slice-r-console-usability.md`
22. **Slice S business chat shell** — In progress: `web-business/` 已 clone assistant-ui 并接 Helios 演示路径；见 `docs/architecture/slice-s-business-chat-shell.md`
23. ~~**Slice T desktop shell**~~ — Implemented: 业务对话落盘 + HN API smoke + AGPL 打包；见 `docs/architecture/slice-t-desktop-proma-shell.md`
24. ~~**Slice U workflow engine reuse**~~ — Implemented (含真实 Hatchet): `docs/architecture/slice-u-workflow-engine-direction.md` / `docs/architecture/hatchet-local.md`
25. ~~**Slice V desktop NL compile loop**~~ — Implemented: `docs/architecture/slice-v-desktop-nl-compile-loop.md`（mock 可验；Live follow-up）

## Development Gate

See `docs/architecture/dev-gate.md`.

1. Write / update slice tech design (`Proposed`)
2. Human marks `Accepted` (or says「按该文档实现」)
3. Agent Reads Required skills → implements in thin increments with tests
4. Acceptance commands green → Status `Implemented`

Template: `docs/architecture/_templates/slice-tech-design.md`

## Development Discipline

For the desktop Workflow Studio work, agents must follow these rules:

1. Work from `tasks/todo.md` in small, verifiable increments.
2. Before changing behavior, read the relevant skill docs and add/adjust tests for the contract being changed.
3. Keep public API changes additive and backward compatible unless a slice design explicitly accepts a breaking change.
4. Update docs in the same increment as code: task status, architecture notes, ADRs, or user-facing guides as appropriate.
5. Run the narrow verification command for the slice, then the broader gate before marking a task complete.
6. Commit each completed increment with a focused message. Stage only files touched for that increment; the worktree may contain unrelated user or agent changes.
7. Never commit secrets, build output, `node_modules`, or unrelated formatting churn.
8. For desktop UI, prefer existing Electron patterns and reusable OSS packages with clear licenses over custom infrastructure.

## Desktop Workflow Studio Code Standards

1. Keep graph data transformation in pure helpers under `desktop/apps/electron/src/renderer/components/workflows/`; UI components only render the already-built model.
2. Use `@xyflow/react` in read-only mode for preview tabs: no node editing, no inline connection creation, no hidden second source of truth.
3. Prefer the compiled IR for dependency edges and runtime state for statuses; treat `workflow` payloads as fallback display data.
4. Make each new workflow UI slice independently testable, then verify with `bun test`, `bun run typecheck`, `bun run build:renderer`, and a browser screenshot before commit.
5. Update the slice design, `tasks/todo.md`, and any relevant ADR or guide in the same increment as the code.
6. Keep preview copy short, literal, and operational; do not add tutorial text inside the app chrome.

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

## Slice J verification (Pi live default)

Design: `docs/architecture/slice-j-pi-live-default.md`

```bash
cd packages/pi-sidecar && npm test
./scripts/smoke-compile.sh
./scripts/smoke-compile-live.sh   # SKIP without key
```

## Slice K verification (evidence viewer)

Design: `docs/architecture/slice-k-evidence-viewer.md`

```bash
cd backend && go test ./internal/httpapi/
./scripts/smoke-lead-sync-gui.sh
# console: select gui step → PNG preview under evidence
```

## Slice L verification (GUI ↔ playwright-cli)

Design: `docs/architecture/slice-l-gui-playwright-cli.md`

```bash
cd packages/gui-operator && npm test
./scripts/smoke-gui-run.sh
HELIOS_GUI_MODE=playwright ./scripts/smoke-gui-run.sh
```

## Slice M verification (Feishu daily-brief / Q1)

Design: `docs/architecture/slice-m-feishu-daily-brief.md`  
Guide: `docs/feishu-cli.md`

```bash
cd backend && go test ./internal/schema/
./scripts/smoke-feishu-daily-brief.sh
# logged-in:
HELIOS_FEISHU_CHAT_ID=oc_xxx ./scripts/smoke-feishu-daily-brief.sh
```

## Slice N verification (live compile harden)

Design: `docs/architecture/slice-n-live-compile-harden.md`

```bash
cd packages/pi-sidecar && npm test
./scripts/smoke-compile.sh
./scripts/smoke-compile-live.sh   # expect validation=true when key present
```

## Slice P / Q verification (OpenCLI)

Design: `docs/architecture/slice-p-opencli-adapter.md`, `docs/architecture/slice-q-opencli-session-read.md`  
Guide: `docs/opencli.md`

```bash
cd backend && go test ./cmd/helios-opencli/
./scripts/smoke-opencli.sh
./scripts/smoke-opencli-session.sh          # SKIP without Bridge
# HELIOS_OPENCLI_REQUIRE_SESSION=1 ./scripts/smoke-opencli-session.sh
```

## Slice O verification (MVP §15)

Design: `docs/architecture/slice-o-mvp-acceptance.md`  
Live Feishu: `docs/acceptance/2026-08-01-feishu-live.md`

```bash
./scripts/smoke-mvp-acceptance.sh
# optional fuller:
HELIOS_MVP_FULL=1 ./scripts/smoke-mvp-acceptance.sh
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
