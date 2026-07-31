# Helios 各模块可借鉴开源清单

Date: 2026-08-01  
Status: Active  
Parent: `docs/research/2026-07-31-helios-reposition-research.md`  
Rule: **优先复用 / 适配，禁止 fork 成第二内核**（尤其不 fork Eko）

## 怎么读

| 标签 | 含义 |
|------|------|
| **直接用** | 当依赖或外部二进制接入，几乎不改源码 |
| **适配层** | 包一层对齐 Helios 契约（`introspect` / envelope / evidence） |
| **学契约** | 对齐规范与行为，不搬代码 |
| **勿吞并** | 过重或与产品定位冲突，只学模式 |

---

## 1. AI 内核 / Compile / `uses: ai`

| 项目 | 许可 | 建议 | 说明 |
|------|------|------|------|
| [earendil-works/pi](https://github.com/earendil-works/pi) | MIT | **直接用（已定）** | 继续 sidecar RPC；不要内嵌成第二编排器 |
| [FellouAI/eko](https://github.com/FellouAI/eko) | — | **学契约 / 勿吞并** | plan/execute、pause、deps；**禁止 fork** |
| OpenClaw × Pi 文档 | — | **学契约** | YAML 多步 + Agent；Helios 步骤默认仍是 CLI |

**落地：** Pi 默认真路径（有 key → live）；mock 仅单测。

---

## 2. CLI 契约 / Factory（OpenAPI → Agent CLI）

| 项目 | 许可 | 建议 | 说明 |
|------|------|------|------|
| [lathe-cli/lathe](https://github.com/lathe-cli/lathe) | MIT | **优先适配 / 可替换自研 codegen** | OpenAPI/Swagger/proto → Cobra；catalog；生成 Skills。Helios Factory 应逐步变成「契约校验 + Lathe/adapter」，而不是长期手写模板 |
| [larksuite/cli](https://github.com/larksuite/cli) | MIT | **直接用 + 适配层（已做）** | 官方飞书 CLI；`helios-lark` 补 `introspect` |
| [oapi-codegen/oapi-codegen](https://github.com/oapi-codegen/oapi-codegen) | Apache-2.0 | **直接用（HTTP 客户端层）** | 复杂 OpenAPI 的 typed client；Helios 再包 envelope / dry-run / argv |
| [ogen-go/ogen](https://github.com/ogen-go/ogen) | Apache-2.0 | 备选 | 严格 OpenAPI 3；适合内部 API |
| [alpibrusl/acli](https://github.com/alpibrusl/acli) | — | **学契约** | introspect / dry-run / exit code / skill |
| [prajapatimehul/agent-ready](https://github.com/prajapatimehul/agent-ready) | — | **学契约** | dry-run、schema、MCP；星少但方向对 |
| FuseCLI / Fern | npm / 商业 | 参考产品形态 | 不宜当内核依赖 |

**落地顺序：**  
1) 契约对齐 ACLI（已有 democli envelope）  
2) 下一刀：`helios-factory` 增加 `--engine=lathe` 或 post-process Lathe 输出为 Helios `introspect`  
3) 复杂 API 用 oapi-codegen 生成 client，Factory 只生成 CLI 壳

---

## 3. GUI 升舱 / Playwright / human_help

| 项目 | 许可 | 建议 | 说明 |
|------|------|------|------|
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | **直接用（已定）** | 当前 `gui-operator` 基座 |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Apache-2.0 | **借鉴动作面，勿整吞 MCP** | 成熟的 navigate/click/type/snapshot/screenshot 工具面；Helios 继续「YAML 选择器 + Go 调度」，可把 operator 动作对齐 MCP 工具名 |
| [jamesmurdza/browser-handoff](https://github.com/jamesmurdza/browser-handoff) | MIT | **human_help 优先借鉴** | pause → 流式给真人 → resume；正是登录/2FA 场景 |
| [nagken/auto-browser](https://github.com/nagken/auto-browser) | — | 学模式 | Playwright + 审批门 + noVNC takeover + audit；偏重，适合抄「接管」交互 |
| Browser MCP / Browser-use | 各异 | 勿作默认执行面 | 真 Chrome / 自由 Agent 与「制品可复现」冲突；仅作人工兜底灵感 |

**落地顺序：**  
1) 保持自研 thin operator（已有）  
2) `human_help` 下一阶段接 browser-handoff 或 noVNC 同会话接管  
3) 动作命名对齐 `@playwright/mcp`，方便以后代理调试，不把 MCP 塞进 runtime 关键路径

---

## 4. Runtime / 审批 / 证据 / 长跑

| 项目 | 许可 | 建议 | 说明 |
|------|------|------|------|
| [temporalio/temporal](+ Go SDK) | MIT | **学模式 / 后期可选引擎** | Signal = 审批/human_help；history = 证据启发。**现阶段勿引入**（运维重）；自研 FS evidence 够用 |
| Kestra / Cadence | Apache | 学制品与调度 UI | 不替换 Helios 制品模型 |
| Restate | 商业偏重 | 仅对照 durable 概念 | — |

**落地：** 继续自研 engine；审批/human_help 语义可对照 Temporal Signal；证据账本保持 Go 文件系统为核心对象。

---

## 5. 飞书 / 业务平台 CLI

| 项目 | 许可 | 建议 | 说明 |
|------|------|------|------|
| [larksuite/cli](https://github.com/larksuite/cli) | MIT | **直接用（已定）** | 200+ 命令 + Skills；扩展 `helios-lark` allowlist 即可 |
| [larksuite/oapi-sdk-go](https://github.com/larksuite/oapi-sdk-go) | MIT | **直接用（若自写薄封装）** | 官方 Go SDK；仅当 CLI 不够时 |
| [larksuite/lark-openapi-mcp](https://github.com/larksuite/lark-openapi-mcp) | — | 可选旁路 | Agent 调试用，不进 Helios 默认执行路径 |

---

## 6. 控制台 / 前端

| 项目 | 建议 | 说明 |
|------|------|------|
| shadcn / Base UI（仓库已定） | **直接用** | 继续 `pnpm ui:add` |
| Temporal Web / Kestra UI | 学证据/时间线布局 | 勿 fork 整站 |
| Playwright trace viewer | 学截图+步骤时间线 | 证据面板可抄交互 |

---

## 推荐落地优先级（可执行）

| # | 动作 | 复用对象 | 替代掉 Helios 里什么 |
|---|------|----------|----------------------|
| 1 | Factory 接 Lathe 适配器 | Lathe MIT | 手写 FileDB/HTTP 模板的复杂路径 |
| 2 | human_help 接同会话接管 | browser-handoff 或 auto-browser 模式 | 纯 API resolve 无浏览器画面 |
| 3 | Operator 动作面对齐 Playwright MCP | `@playwright/mcp` 工具语义 | 自创动作命名 |
| 4 | 复杂 API → oapi-codegen client + Helios 壳 | oapi-codegen | 手写 `httpJSON` |
| 5 | 飞书扩大 allowlist | larksuite/cli | 自写飞书 API |
| 6 | （后期）评估 Temporal Signal | Temporal | 仅当需要跨进程长跑/集群 |

## 明确不做

- Fork Eko 当编排内核  
- 默认执行面改成 Browser-use / 自由浏览器 Agent  
- 现在就把 Temporal 拉进依赖树  
- 把 MCP 当 Runtime 热路径（MCP 留给 Agent 调试旁路）
