# Slice K — Console Evidence Viewer

Status: Implemented  
Date: 2026-08-01  
Parent: Slice B console, Slice E GUI evidence, Slice H viewerUrl  
Gate: `docs/architecture/dev-gate.md`

## Goal

控制台能直接看证据，不必翻本机 `runDir`：

1. `GET /api/v1/runs/{runId}/files/{path...}` 安全提供 run 目录内文件（PNG / stdout 文本）  
2. 证据卡展示 **截图预览**（`screenshotRef`）  
3. 步骤输出里的 **`viewerUrl`** 可点开（已有 human_help 卡；证据区同步）  
4. 文本证据（stdout/stderr）可折叠展开  

## Non-goals

- 全量证据时间线重设计 / 无限滚动  
- S3 / CDN 远程证据  
- 视频回放  
- Slice L（playwright-cli 动作面）  

## Architecture

```text
Evidence.screenshotRef = "evidence/001-gui.png"
        │
        ▼
Console <img src="{API}/runs/{id}/files/evidence/001-gui.png">
        │
        ▼
httpapi resolve under store.RunDir(id)  (path clean, no .. escape)
```

## Contracts

### API

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/v1/runs/{runId}/files/{path...}` | raw bytes + Content-Type（png/json/text） |

错误：404 run/file；400 路径越界。

### Console

- `runFileURL(runId, rel)` helper  
- evidence item：PNG `<img>`；stdout/stderr `<details>`；有 `viewerUrl` 则链接  

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| K1 | 本文 | — |
| K2 | files handler + Go test | `go test ./internal/httpapi` |
| K3 | client + App evidence UI + CSS | 手测 / typecheck |
| K4 | docs + commit | git |

## Code standards

- 仅 `httpapi`、`web/src`、本设计、`agent.md`  
- 路径必须 `filepath.Clean` + `HasPrefix(runDir)`  
- 保持现有控制台视觉语言，不加营销卡  

## Required skills

- `api-and-interface-design`  
- `frontend-ui-engineering`  
- `test-driven-development`  
- `incremental-implementation`  

## Acceptance

```bash
cd backend && go test ./internal/httpapi/
# optional: run GUI smoke then open console evidence for screenshot
./scripts/smoke-lead-sync-gui.sh
```

## Risks / Rollback

路径穿越：前缀检查。回滚本切片提交即可。
