# Slice H — human_help Session Handoff

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/architecture/slice-e-gui.md`, PRD F-G3  
Reuse: browser-handoff **协议**（MIT，不绑 Python 包）— `docs/research/2026-08-01-best-fit-oss.md`  
Gate: `docs/architecture/dev-gate.md`

## Goal

当 workflow 进入 `uses: gui` / `action: human_help` 时：

1. 在 **同一 Playwright 浏览器会话** 中打开目标页（或复用已有 session）  
2. 向操作者提供 **可打开的实时查看/接管 URL**（本机）  
3. Runtime 保持 `WAITING_HUMAN`，直到：
   - Console / API `POST .../human-help` resolve，或  
   - 操作者在 handoff UI 点「完成」，或  
   - 超时  
4. 证据：开始/结束截图 + helpId + note + mode=`playwright-handoff`

已有「API resolve 阻塞」保留；本切片补上 **真会话 + 真人可见页面**。

## Non-goals

- npm/pip 依赖 `browser-handoff` 包（太新、Python）  
- noVNC 完整桌面（可 Follow-up；MVP 用 Playwright page + 截图流/简单 live view）  
- 默认路径 Stagehand/Browser-use  
- 反 bot / 指纹对抗  

## Reuse

| 对象 | 用法 |
|------|------|
| browser-handoff | **只学协议**：trigger → stream URL → wait complete → resume |
| Playwright | 已有 operator；扩展 session 生命周期 |
| 现有 Go `WAITING_HUMAN` + `/human-help` | 不变；operator 侧可主动回调或仍由 API resolve |

## Architecture

```text
Engine runGUIHumanHelp
    │
    ├─ POST /v1/human_help/start {reason, url?}
    │         │
    │         ▼
    │   gui-operator: create/reuse Playwright session
    │         open url (if provided)
    │         start handoff viewer on 127.0.0.1:<port>
    │         return {helpId, viewerUrl, mode}
    │
    ├─ persist WAITING_HUMAN + viewerUrl in step output / evidence meta
    │
    └─ wait channel  ◄── Console resolve 或 POST /v1/human_help/resolve
                              │
                              ▼
                         screenshot → close viewer → optional keep session
```

## Contracts

### Operator

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/v1/human_help/start` | `{reason, url?, sessionId?, timeoutMs?}` | `{helpId, status, viewerUrl, mode, sessionId}` |
| GET | `/v1/human_help/{helpId}/viewer` | — | HTML：当前页截图刷新或简易指导 + 「完成/放弃」按钮 |
| POST | `/v1/human_help/resolve` | `{helpId, ok, note?}` | `{ok, helpId}`（已有） |

`viewerUrl` 形如 `http://127.0.0.1:8792/v1/human_help/<id>/viewer`。

### Workflow

```yaml
- id: login_help
  uses: gui
  action: human_help
  prompt: "请完成登录后继续"
  gui:
    url: "${params.login_url}"   # 可选；有则打开
  out: help
```

### Go / Console

- Step output 增加 `viewerUrl`（若有）  
- Console 在 WAITING_HUMAN 时展示链接 + 现有「已处理/放弃」  

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| H1 | 本文 Accepted | — |
| H2 | operator：start 返回 `viewerUrl`；viewer 页轮询截图 + 完成按钮调 resolve | `npm test` |
| H3 | start 可选 `url` → Playwright goto；证据前后截图 | playwright 测 |
| H4 | Go：把 `viewerUrl` 写入 step output；console 展示 | `go test` + 手测 |
| H5 | smoke：`smoke-human-help.sh`（自动点 viewer 完成或 API resolve） | 脚本绿 |

## Code standards

- 仅 `packages/gui-operator` + 既有 guiclient/engine/console；不新语言栈  
- Viewer 本机绑定 `127.0.0.1`；helpId 用 UUID  
- 超时默认与现有 long-poll 一致（可配置）  
- **Never：** 把 viewer 暴露到 `0.0.0.0` 无鉴权；在证据里存 cookie/密码  

## Required skills

1. `documentation-and-adrs`  
2. `api-and-interface-design` — operator/Go/console 契约对齐  
3. `test-driven-development` — viewer resolve 单测优先  
4. `incremental-implementation` — H2→H5  
5. `security-and-hardening` — 本机绑定、超时、无密钥入证据  
6. `frontend-ui-engineering` — console 展示 viewerUrl（小改）  
7. `browser-testing-with-devtools`（若需实机核验 viewer）  

## Security

- Viewer 仅 localhost  
- Session 结束后关闭 page（或显式 keep 由设计说明）  
- Screenshot 证据；不记录输入框密码值  

## Acceptance

```bash
cd packages/gui-operator && npm test
cd backend && go test ./internal/runtime/ ./internal/guiclient/ -count=1
./scripts/smoke-human-help.sh   # 新建；WAITING_HUMAN → COMPLETED，证据含截图
```

## Risks / rollback

- 简易截图刷新体验差 → Follow-up CDP screencast / noVNC  
- 无 `url` 的 human_help 仍可 API-only（兼容 Slice E 已实现行为）  

## Follow-ups

- 动作面对齐 playwright-cli  
- 真流式视频接管  
- Steel browser 作可选远端会话  
