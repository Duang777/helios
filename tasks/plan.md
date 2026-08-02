# Implementation Plan: Helios Desktop Workflow Studio

Date: 2026-08-01

## Overview

Helios 后续主线改成桌面端优先：在已经 clone 魔改的 Proma/Electron 壳里做一个可用的 Workflow Studio，让业务用户用自然语言生成可版本化 workflow，并在同一桌面窗口里完成校验、修补、预览、保存、运行、审批和查看 evidence。后端继续保留 Go + YAML + Hatchet/本地 scheduler 作为真执行内核；桌面端负责把这条链路做成产品。

## Reuse Strategy

- Direct reuse: `desktop/` 继续作为 Proma AGPL 桌面基线，不再自研 Electron/Tauri 壳。
- Package reuse: 引入 MIT 的 node graph UI 包（首选 `@xyflow/react` / React Flow）做 workflow graph canvas，而不是手写复杂画布。
- Pattern reuse: 借 Kestra Agent Skills 的 schema-grounded YAML 生成纪律：先给 agent schema/registry，再生成，再 validate/repair，禁止瞎编 task/property。
- Pattern reuse: 借 Activepieces 的 pieces 概念做 connector registry 和参数表单，但不整包依赖它的 server/worker。
- Pattern reuse: 借 VoltAgent 的 TypeScript workflow authoring 形态，做很薄的 `helios-workflow-ts`，编译到 Helios YAML。
- Avoid for now: n8n/Dify/Flowise/Langflow 只作 UI/DSL 参考，不把完整平台引入桌面内核。

## OSS Research Notes

- Proma: 已在 `desktop/` 作为 AGPL-3.0 桌面壳基线，见 `desktop/UPSTREAM.md`。
- Kestra agent-skills: 已 clone 到 `/tmp/helios-oss-20260801/kestra-agent-skills`，pin `2f405bdd073f1f22df9824e11171ca62a0e69786`。可复用的是生成规则，不直接拷代码；仓库未见 LICENSE 文件，引入正文需另查授权。
- Activepieces: GitHub 页面显示 Community Edition MIT、EE 商业许可；优先学习 pieces/integration 目录结构，不依赖 EE。
- React Flow / xyflow: GitHub 页面显示 React Flow/Svelte Flow MIT，适合直接作为桌面 graph canvas 依赖。
- VoltAgent / Dify DSL skill: 本轮 GitHub clone 超时；保留为后续重试项，先不作为阻塞依赖。

## Target Architecture

```text
Desktop Workflow Studio
  Intent chat / compiler panel
  YAML + TS editor
  Graph preview
  Validation + repair report
  Run / approval / evidence panels
        |
        | localhost HTTP
        v
Helios Go API
  /compile
  /workflows
  /runs
  /approval
  /evidence
        |
        v
Scheduler
  inprocess default
  Hatchet optional durable path
```

Artifact output stays folder-first:

```text
workflows/<workflow-id>/
  workflow.yaml
  workflow.ts
  INTENT.md
  manifest.json
  fixtures/
```

## Architecture Decisions

- Desktop is the primary product surface; `web-business/` becomes secondary smoke/reference UI.
- YAML remains the execution contract. TypeScript is an authoring convenience, compiled into YAML.
- The compiler returns structured results: `intent -> IR -> yaml -> validation -> repairAttempts[]`.
- The desktop does not execute arbitrary generated TS. TS workflow code is compiled and validated; later `uses: code` must be sandboxed separately.
- Hatchet remains only a scheduler adapter. Helios fs store remains the source of truth for runs, approvals, and evidence.

## Phases

### Phase 1: Desktop Compiler Workbench

Turn the existing chat compile loop into an explicit desktop workbench: prompt input, generated YAML, validation errors, warnings, one-click repair, save, run.

### Phase 2: Workflow Graph Preview

Add node graph preview from validated YAML. Use React Flow/xyflow or equivalent MIT package. Nodes show step type, status, approval gates, and evidence links.

### Phase 3: Artifact Folder Drafts

Desktop can create/import/export workflow folders. Every NL draft gets `workflow.yaml`, `INTENT.md`, optional fixtures, and manifest.

### Phase 4: TS Authoring Layer

Add a small `packages/workflow-ts` DSL that compiles deterministic TS declarations to Helios YAML. Desktop shows TS and YAML side by side.

### Phase 5: Connector Registry UX

Expose existing CLI registry and future pieces as searchable desktop building blocks. Compiler prompt receives machine-readable allowed tools.

### Phase 6: Polish and Packaging

Bundle local API startup checks, Hatchet optional status, OSS attribution, and a desktop smoke suite.

## Verification Gates

- Backend: `cd backend && go test ./...`
- Desktop typecheck: `cd desktop && bun run typecheck`
- Desktop build: `cd desktop && bun run build:renderer`
- Existing API smoke: `./scripts/smoke-desktop-helios-api.sh`
- Existing compile smoke: `./scripts/smoke-desktop-nl-compile.sh`
- Hatchet optional smoke: `./scripts/smoke-hatchet-scheduler.sh`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OSS license ambiguity | High | Only direct-copy code with clear LICENSE; otherwise copy pattern, not code |
| Desktop bundle grows too fast | Medium | Add graph/editor packages only after proving first canvas slice |
| Generated YAML unsafe | High | Schema + registry validation before save/run; repair loop has max attempts |
| TS DSL becomes a second runtime | High | TS only compiles to YAML in v1; no arbitrary execution |
| Hatchet/local runner divergence | Medium | Same `/runs` API and same runtime engine; scheduler is adapter only |

## Open Questions

- Whether we want AGPL desktop shipping as the default public product, or later replace Proma with MIT/Apache shell for closed distribution.
- Whether first graph editor is preview-only or allows drag-to-edit in the same milestone. Recommendation: preview-only first.
