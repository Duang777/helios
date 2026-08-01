# Helios 各模块「最合适」选型（决选）

Date: 2026-08-01  
Status: Active  
Previous broad list: `docs/research/2026-08-01-reuse-oss-by-module.md`

## 筛选标准（硬）

1. **许可**：MIT / Apache-2.0 优先；ELv2 / 商业生成器不当内核依赖  
2. **契合**：CLI 优先、制品可复现、选择器进 YAML、Go 控制面  
3. **接入成本**：能当二进制/库适配，而不是换掉 Helios 内核  
4. **成熟度**：有真实维护；0⭐ 玩具只学模式不绑死  

---

## 决选一览

| Helios 模块 | **最合适** | 为什么赢 | 明确落选 |
|-------------|------------|----------|----------|
| AI 内核 | **[Pi](https://github.com/earendil-works/pi)** (MIT) | 已定 ADR；sidecar 边界清晰 | Eko（学不吞）、自研 agent loop |
| 业务平台 CLI（飞书） | **[larksuite/cli](https://github.com/larksuite/cli)** (MIT) | 官方、Agent Skills、200+ 命令；已有 `helios-lark` 适配 | 自写 oapi-sdk 封装（仅 CLI 不够时备用） |
| 无公开 API → CLI（网页结晶） | **[OpenCLI](https://github.com/jackwener/opencli)** (Apache-2.0) | Website→确定性 CLI；复用 Chrome 登录；explore/synthesize/generate；与 CLI-first 叙事贴 | 默认 Stagehand/Browser-use（运行时 LLM 点选）；裸 `uses: gui`（无结晶时兜底仍保留） |
| OpenAPI→CLI Factory | **[Lathe](https://github.com/lathe-cli/lathe)** (MIT) | 唯一同时满足：MIT + Go/Cobra + catalog/skills + OpenAPI/proto；与 Helios Go 同栈 | **Speakeasy**（能力更强但 ELv2+平台；不当工厂引擎）、Fern/Stainless（商业）、openapi-generator（重且不 agent-first）、手写模板（只留极简兜底） |
| HTTP typed client（Factory 底层） | **[oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)** (Apache-2.0) | Go 事实标准；Lathe/自研壳下面的 client 层 | ogen（备选）、手写 `httpJSON`（demo 可以，生产 API 不行） |
| 确定性 GUI 执行 | **Playwright** + 自研 thin operator | PRD：选择器在 YAML；确定性优先 | Stagehand / Browser-use（运行时 AI 点选，破坏复现） |
| GUI 动作面参考 | **[playwright-cli](https://github.com/microsoft/playwright-cli)** (Apache-2.0) | 「浏览器动作也是 CLI」——与 Helios 哲学最贴；可对照命令面 | `@playwright/mcp`（调试旁路很好，勿进 runtime 热路径） |
| human_help 同会话接管 | **模式取自 [browser-handoff](https://github.com/jamesmurdza/browser-handoff)** (MIT)，实现落在 `gui-operator` | 场景精确：pause→真人→resume；库本身太新(≈0⭐)/Python，**不绑依赖**，移植协议到 Node | auto-browser（过重）、Steel（偏云浏览器基建，可选后期）、Stagehand（不是接管工具） |
| Runtime / 审批长跑 | **继续自研 Go engine** | 证据/审批/CLI 契约是产品差异；现在引编排引擎成本 > 收益 | Temporal（过重）、Hatchet（**后期第一候选**，MIT+Postgres）、River Pro（工作流在商业层） |
| 控制台证据 UI | **自研 + 学 Playwright Trace / Temporal Web 时间线** | 只抄交互，不 fork 整站 | — |

---

## 逐项理由（短）

### Factory：为什么是 Lathe 不是 Speakeasy？

Speakeasy 的 agent-mode CLI / Cobra / SDK 质量更高，但是：

- CLI 本体是 **Elastic License 2.0**，不适合作为 Helios「工厂内核」长期依赖  
- 生成往往绑平台 key / 配额  

Lathe：**MIT、本地 bootstrap、生成 Skills、catalog JSON**，正好是 Helios Factory 该做的事。  
Helios 保留：契约校验、`introspect` 归一、registry、证据；**生成器外包给 Lathe**。

### 无 API：为什么是 OpenCLI 而不是直接 GUI / Stagehand？

没公开 API 时仍应尽量 **先结晶成 CLI**（可复跑、可审批、可进 Registry），再执行。

- **OpenCLI**：站点→adapter 命令；运行时不烧 token；Helios 用 `helios-opencli` 包 introspect（Slice P Proposed）  
- **`uses: gui`**：无 adapter / 一次性页面时的兜底  
- **Stagehand**：禁止作为默认执行面（运行时 LLM 点选）  

### GUI：为什么不是 Stagehand？

Stagehand 很强，但默认是 **运行时 AI 解析「点哪个」**。Helios F-G4 要求选择器来自制品。  
正确分层：

- 有结晶 CLI：OpenCLI / 官方 CLI / factory  
- 默认 GUI：`uses: gui` + YAML selector + Playwright  
- 升舱：`human_help` 真人接管（browser-handoff 模式）  
- 禁止：默认路径上的自由浏览器 Agent  

### human_help：为什么「学 browser-handoff」而不是 npm 依赖它？

它是目前**问题定义最准**的开源（登录/2FA/OAuth 同会话）。但：

- 星少、Python、早期  
- Helios operator 已是 Node  

→ **抄协议进 `packages/gui-operator`**（stream URL + wait complete + evidence），不要把运行时绑到未成熟包。

### Runtime：为什么现在不换 Hatchet/Temporal？

审批/human_help 语义像 Signal，但 Helios 的核心对象是 **workflow 制品 + CLI 证据账本**，不是通用 durable job。  
等出现「进程挂了还要续跑跨天审批」再评估 **Hatchet**（比 Temporal 轻、MIT）。

---

## 执行顺序（只做决选）

1. **Factory → Lathe 适配器**（替换复杂 OpenAPI 手写模板）  
2. **human_help → 同会话接管**（移植 browser-handoff 协议到 gui-operator）  
3. **Operator 动作面 → 对齐 playwright-cli 命令语义**  
4. **飞书 → 继续扩 larksuite/cli allowlist**  
5. **（可选后期）** oapi-codegen 吃复杂 API；Hatchet 评估 durable  

## 一句话

> **Pi + Lathe + lark-cli + OpenCLI(web→CLI) + Playwright(thin) + browser-handoff 协议自研 + 自研 Go runtime**  
> 这是当前与 Helios 定位最贴、许可最干净的组合；Speakeasy/Temporal/Stagehand/Browser-use 都更「炫」，但不是最合适。
