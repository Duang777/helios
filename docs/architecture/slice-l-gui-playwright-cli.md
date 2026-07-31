# Slice L — GUI Action Surface ↔ playwright-cli

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/architecture/slice-e-gui.md`, `docs/research/2026-08-01-best-fit-oss.md`  
Reuse: playwright-cli **命令语义**（Apache-2.0）— 不依赖 `@playwright/cli` 二进制  
Gate: `docs/architecture/dev-gate.md`

## Goal

把 `gui-operator` 的动作面对齐 [playwright-cli](https://github.com/microsoft/playwright-cli) Core 动词，使 YAML 里的 GUI 步骤可读、可复现：

1. 原语：`open` / `goto` / `click` / `fill`（=`type`）/ `press` / `hover` / `select` / `check` / `uncheck` / `screenshot` / `extract` / `close`  
2. 复合：`POST /v1/actions/run` 顺序执行 `steps[]`  
3. Workflow：`action: run` + `gui.steps`（选择器仍为 **CSS**，制品可复现）  
4. 保留 `screenshot_and_confirm`、`human_help`  

## Non-goals

- 引入 playwright-cli a11y `ref`（e21 等）作为默认选择器  
- 依赖全局 `playwright-cli` 二进制  
- LLM 在运行时发明点击  
- drag/drop/upload/全套 CLI  

## Selector policy

| 来源 | Helios |
|------|--------|
| playwright-cli `ref` | **不采用**（运行时才有，破坏制品复现） |
| CSS / Playwright selector | **默认**，写在 YAML |
| `snapshot` | Follow-up；本切片用 `extract` 取文本 |

## Architecture

```text
workflow action: run
  gui.steps: [{op:open,url},{op:fill,...},{op:click,...},{op:screenshot}]
        │
        ▼
Go engine eval strings → guiclient.Run
        │
        ▼
gui-operator /v1/actions/run → Playwright (or fake)
        │
        ▼
evidence PNG + results[]
```

## Contracts

### Operator HTTP（新增 / 对齐）

| Path | Body | Notes |
|------|------|-------|
| POST `/v1/goto` | `{sessionId, url}` | 已有 session 导航 |
| POST `/v1/fill` | `{sessionId, selector, text}` | alias of type |
| POST `/v1/press` | `{sessionId, key, selector?}` | |
| POST `/v1/hover` | `{sessionId, selector}` | |
| POST `/v1/select` | `{sessionId, selector, value}` | |
| POST `/v1/check` | `{sessionId, selector}` | |
| POST `/v1/uncheck` | `{sessionId, selector}` | |
| POST `/v1/actions/run` | `{steps:[{op,...}]}` | 自动 close；返回末次 screenshot |

已有：`/v1/open` `/v1/click` `/v1/type` `/v1/extract` `/v1/screenshot`

### Workflow

```yaml
- id: fill_form
  uses: gui
  action: run
  sideEffect: write
  gui:
    steps:
      - op: open
        url: "${params.form_url}"
      - op: fill
        selector: "#note"
        text: "${params.note}"
      - op: click
        selector: "button#submit"
      - op: screenshot
  out: gui
```

Schema：`action: run` 要求 `gui.steps` 非空；**不**强制顶层 `gui.url`（url 在 `open`/`goto` 步内）。

### Go

- `GUIRunner.Run(ctx, {Steps})`  
- `runGUI` case `"run"`  

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| L1 | 本文 | — |
| L2 | operator 原语 + run + 单测 | `npm test` |
| L3 | guiclient + engine + schema | `go test` |
| L4 | fixture form + `demo.gui-run.yaml` + smoke | fake/playwright 绿 |
| L5 | docs Implemented；提交 | git |

## Code standards

- 包：`packages/gui-operator`、`guiclient`、`runtime`、`schema`、workflows、docs  
- 不新增 npm 依赖（仍用 optional playwright）  
- fake 模式：原语 no-op 成功，screenshot 仍返回 FAKE_PNG  

## Required skills

- `api-and-interface-design`  
- `incremental-implementation`  
- `test-driven-development`  
- `documentation-and-adrs`  

## Acceptance

```bash
cd packages/gui-operator && npm test
cd backend && go test ./internal/schema/ ./internal/guiclient/ ./internal/runtime/ ./internal/httpapi/
./scripts/smoke-gui-run.sh
```

## Risks / Rollback

多步失败中途：`run` 在 finally 关 session，返回错误；证据可无图。回滚本切片提交。
