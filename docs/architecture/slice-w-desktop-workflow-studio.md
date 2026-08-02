# Slice W — Desktop Workflow Studio

Status: Implemented
Date: 2026-08-01
Accepted-by: user（对话确认：开始开发；先落 PRD、代码规范、完整设计）
Parent: Task 3 in `tasks/todo.md` / Slice T / Slice V
Reuse: Proma desktop shell in `desktop/`; Helios `/api/v1` compile/workflow/run contract
Gate: `docs/architecture/dev-gate.md`

## PRD

### Problem

业务用户可以在桌面对话里触发自然语言编译，但缺少一个可复用工作台来检查、修正、保存和运行工作流草稿。对话路径适合快速执行，Workflow Studio 负责把“临时想法”沉淀成可审计、可复跑的 workflow artifact。

### Users

- 业务运营：用自然语言描述流程，确认 YAML 和校验结果后运行。
- 内部 agent/开发者：调试 compiler 输出、repair attempts、运行参数和保存结果。

### V1 success

1. 桌面左侧导航可进入 Workflow Studio。
2. 用户输入自然语言后，桌面调用 `POST /api/v1/compile`，展示 YAML、validation、warnings、repair attempts 和 IR 摘要。
3. `validation.ok` 时可保存到 `PUT /api/v1/workflows/:id`，并可通过 `POST /api/v1/workflows/:id/runs` 启动一次运行。
4. 运行结果显示 run id、status、current step 和 completed steps；审批细节留给 Slice X/Task 8。

### Non-goals

- 图编辑器和运行态图预览（Task 4）。
- workflow folder import/export（Task 5）。
- TypeScript DSL authoring（Task 6）。
- connector palette 和 schema 插入器（Task 7）。
- 审批按钮、证据浏览器、实时 timeline（Task 8）。
- 改 Go compile/workflow/run API 契约。

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| Proma desktop shell | AGPL-3.0 | 直接复用当前 `desktop/` renderer、sidebar、active view、ui 组件 |
| Helios client helpers | 本仓库 | 复用 `compileIntent` / `saveWorkflow` / `startRun` / `waitForRun` |
| Helios compile IR | 本仓库 | 展示摘要；不另造前端 workflow schema |
| lucide-react | ISC | 导航和按钮图标 |

**禁止：** 引入第二套 Electron 壳；为 v1 手写新 DSL；在 renderer 里绕过 `lib/helios/client.ts` 直接散落 `fetch`；提交 Proma upstream 的无关格式化。

## Architecture

```text
LeftSidebar
  -> activeViewAtom = "workflow-studio"
MainArea
  -> WorkflowStudioView
      intent textarea
      compile action -> lib/helios/client.compileIntent
      YAML / validation / IR panels
      save action -> saveWorkflow(id, yaml)
      run action -> startRun(id, params) -> waitForRun
Helios API localhost
  -> compile / workflows / runs
```

Workflow Studio 是桌面主区域的全屏工具视图，和 `planning`、`agent-skills` 同级；不进入会话 tab，不写聊天消息，不复用对话 pending compile state。

连接器目录分三层来源：

- 本地 CLI registry：Helios 后端已登记的 CLI 连接器。
- 工作区 MCP：当前项目保存的 stdio / HTTP MCP 配置，以及 Helios 内置平台。
- 社区 MCP registry：Helios 后端代理官方 MCP Registry，桌面通过 `GET /api/v1/mcp-registry/servers` 读取，不直接对外站点发请求。

## Contracts

### Renderer state

- `intent: string`
- `compileResult: CompileResult | null`
- `draftYaml: string`
- `status: idle | compiling | ready | saving | saved | running | error`
- `savedWorkflowId: string | null`
- `run: WorkflowRun | null`
- `errorMessage: string | null`

### Save / run rules

- Save enabled only when `compileResult.validation.ok === true` and `draftYaml.trim()` is non-empty.
- Workflow id comes from `compileResult.workflow.id`; fallback to `compileResult.ir.id`.
- Run uses saved workflow id; if current draft is not saved, run first saves it.
- Run params come from existing `extractRunParams(intent, workflow)`; missing values use that helper's defaults.

### Error semantics

- API/network errors show an inline alert with retry possible.
- Validation errors do not block YAML preview, but block save/run.
- Unknown fields are backend validation failures; renderer must display them, not silently repair client-side.

## Implementation plan

| Step | Delivery | Proof |
|------|----------|-------|
| 1 | PRD/technical design and code standards | docs commit |
| 2 | Pure helpers for Studio state: title, readiness, run params | `cd desktop && bun test ...workflow-studio-helpers.test.ts` |
| 3 | `WorkflowStudioView` UI wired to Helios client | `cd desktop && bun run typecheck` |
| 4 | Sidebar/MainArea entry and task/doc status update | `cd desktop && bun run build:renderer` |

Every step must leave the repo in a runnable state and receive a focused commit when complete.

## Code standards

- Package paths:
  - UI: `desktop/apps/electron/src/renderer/components/workflows/`
  - Shared client/data helpers: `desktop/apps/electron/src/renderer/lib/helios/`
  - Navigation state: `desktop/apps/electron/src/renderer/atoms/active-view.ts`
- Naming:
  - Component names use `WorkflowStudio*`.
  - Pure helper names are action/state oriented: `getWorkflowDraftId`, `canSaveDraft`, `buildStudioRunParams`.
  - User-visible labels are concise Chinese; no feature-tour copy in the app.
- UI:
  - Use existing `Button`, `Textarea`, `Badge`, `Alert`, `ScrollArea`, `Tooltip` components.
  - Use lucide icons for icon buttons and sidebar entry.
  - Dense desktop tool layout: editor/result split, no hero page, no nested cards, no decorative gradients.
  - Text areas and preview panes need stable min/max heights and `min-w-0` so long YAML/error text cannot break layout.
- State and errors:
  - Keep remote side effects in event handlers; pure helpers stay unit-testable.
  - Store only latest compile/run in local component state for v1; no persistence until folder import/export.
  - Show backend messages as data. Do not parse YAML in renderer for validation truth.
- Tests:
  - Add unit tests for every new pure helper.
  - Run focused Bun test first, then renderer typecheck/build.
- Git:
  - Stage only Task 3 files. The worktree may contain unrelated modified/untracked files.
  - Desktop-authored diffs should pass focused `git diff --check -- <touched files>`.

## Required skills

1. `frontend-ui-engineering`
2. `spec-driven-development`
3. `incremental-implementation`
4. `test-driven-development`
5. `documentation-and-adrs`
6. `git-workflow-and-versioning`

## Security

- Workflow Studio talks only to configured local Helios API (`VITE_HELIOS_API` or localhost default).
- It must not read files, spawn local processes, or expose arbitrary filesystem paths.
- YAML is displayed as text; renderer must not execute generated code.
- Error text from the API is untrusted display data.

## Acceptance

```bash
cd desktop && bun test apps/electron/src/renderer/components/workflows/workflow-studio-helpers.test.ts
cd desktop && bun run typecheck
cd desktop && bun run build:renderer
./scripts/smoke-desktop-nl-compile.sh
```

Manual:

1. Start Helios API on localhost.
2. Open desktop dev app.
3. Enter `把线索 L-123 同步成采购单，写前要审批`.
4. Compile shows YAML and validation OK.
5. Save succeeds.
6. Run creates a run and displays latest status.

## Risks / rollback

- API offline: UI shows inline error; no global state changes.
- Long YAML breaks layout: rollback is removing the `workflow-studio` active view branch and sidebar entry.
- Run reaches `WAITING_APPROVAL`: v1 displays status only; Task 8 owns approval actions.

## Follow-ups

- Task 4: graph preview with `@xyflow/react`.
- Task 5: workflow folder import/export.
- Task 6: TypeScript DSL preview.
- Task 8: run timeline, approvals, evidence panel.

## Status log

- 2026-08-01: Implemented Workflow Studio active view, sidebar entry, compile/save/run UI, helper tests, and root `build:renderer` script.
- 2026-08-01: Verified in browser against localhost Helios API: compile → save → run, reaching `WAITING_APPROVAL` for `run_168109111400f013`.
- 2026-08-02: Task 5 landed in the desktop shell as workflow folder import/export plumbing, folder preview UI, and `INTENT.md`/`manifest.json` export support; verified with `./scripts/smoke-workflow-folder.sh` and `cd desktop && bun run typecheck`.
- 2026-08-02: Task 7 landed as a live Connector Registry panel in Workflow Studio, reusing the backend CLI registry and inserting connector prompts at the caret; verified with focused Bun tests, `cd desktop && bun run typecheck`, and `cd desktop && bun run build:renderer`.
- 2026-08-02: Extended the Connector Registry with workspace MCP and built-in platform catalogs, so the desktop now exposes both CLI-style connectors and project-scoped business platforms in one insertable registry.
- 2026-08-02: Simplified the Connector Registry into a single directory view, added a Helios-proxied community MCP registry source (`GET /api/v1/mcp-registry/servers`), and documented the desktop startup path plus optional `HELIOS_MCP_REGISTRY_BASE_URL` override.
- 2026-08-02: Reworked the Connector Registry into an expandable MCP center launcher with a full-width modal, category tabs, and card-style browsing for community/workspace/builtin/CLI connectors so the business-facing surface is no longer cramped inside the workflow column.
- 2026-08-02: Tightened the Connector Registry launcher into a compact tool-row entry and flattened the MCP center summary into lightweight badges, with the source/provenance documented in `docs/architecture/connector-center.md`.
- 2026-08-02: Added a curated open-source MCP section to the Connector Registry, seeding the panel with public OpenWork and Craft entry points and moving that layer ahead of the broader community registry.
