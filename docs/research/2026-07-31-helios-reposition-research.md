# Helios 产品调研报告

**日期：** 2026-07-31  
**状态：** 初稿，供 PRD 决策  
**范围：** 自然语言编译可复用工作流；业务平台 CLI 为主；GUI 为辅；Pi 为 Agent 内核；Go 为编排与运行时。  
**说明：** 本文调研外部技术与竞品。现有 Helios 仓库代码暂不作为实现约束。

---

## 1. 调研结论（先看这个）

1. **市场空位真实存在。** 一边是「每次聊天现想步骤」的 Agent（Eko、Browser-use、各类 Coding Agent），另一边是「人先写好 YAML/代码再跑」的编排器（Temporal、Kestra、Prefect、n8n）。中间缺的是：**自然语言一次编译成可版本化制品，之后可复现、可被 AI 再调用，副作用主要通过业务 CLI 完成。**

2. **不要 fork Eko。** Eko 的价值是 Plan→Execute、依赖并行、暂停恢复、人机确认。它的中心是浏览器 Agent 与 XML 计划。Helios 的中心应是 **工作流制品 + 平台 CLI**。借思想，不借运行时。

3. **Pi 适合做 AI 内核，不适合独自做业务编排器。** Pi 提供最小 Agent harness、RPC/SDK、skill/extension、树状 session。OpenClaw 已验证「嵌入 Pi」。Pi 默认不做 plan mode、不做权限弹窗、不做 MCP。这些正好由 Helios 编排层补上。

4. **Go 适合做编译器、调度、证据、审批、进程编排。** 不适合替换 Pi。推荐 **Go control plane + Pi sidecar**。

5. **「构造业务平台 CLI」已有独立赛道。** Lathe、FuseCLI、agent-ready、Fern、ACLI 等都在做 OpenAPI→Agent 友好 CLI。Helios 不应从零发明 CLI 规范，应定义 **契约**，生成器可自研或接入现成工具。

6. **第一版应证明三件事，而不是做成大而全平台：**  
   (a) NL → 可提交的 workflow 制品；  
   (b) 制品经 CLI 稳定复跑；  
   (c) AI 能把该制品当工具再次调用。

---

## 2. 问题定义

### 2.1 用户痛点

企业业务动作散落在多个后台：CRM、ERP、电商后台、审批系统、内部运营台。现状通常是：

- 人手工点 GUI，或写一次性脚本，难复用。
- RPA 录屏脆弱，页面一变就坏。
- 直接给 Agent 浏览器权限，难审计、难复现、难权限收敛。
- 编排器要人先写好 flow，业务侧进不去。
- LLM 每次重新规划，同一业务今天和明天路径不同，无法当「组织资产」。

### 2.2 Helios 要解决的核心问题

把业务目标变成三类稳定资产：

1. **平台 CLI**：对某个业务系统的可发现、可 dry-run、JSON 输出的命令面。  
2. **Workflow 制品**：YAML 或代码，可 diff、可 review、可版本化。  
3. **Run 证据**：每次执行的命令、输出、审批、截图、结论，可复核。

AI 负责 **编译与修订制品**，以及少数标注为 AI 的节点。日常复现尽量不靠「再聊一遍」。

### 2.3 成功时的世界

- 业务或实施同学用自然语言描述目标，得到一份可提交的 workflow。  
- 工程师 review 后合入仓库。  
- 定时或事件触发同一制品，参数不同但步骤稳定。  
- 其他 Agent 通过 `run_workflow(id, params)` 调用，而不是复制 prompt。  
- 危险写操作必须审批。无 API 的页面才走 GUI，并留下证据。

---

## 3. 相关技术深度调研

### 3.1 Eko（FellouAI/eko）

| 项 | 内容 |
|---|---|
| 定位 | 自然语言 → 多智能体工作流；浏览器 / Node / 扩展 |
| 技术 | TypeScript monorepo；`@eko-ai/eko` + nodejs/web/extension |
| 版本 | 约 4.1.x（调研时） |
| 星标 | 约 4.9k（2026-07） |
| 许可 | MIT |
| 文档 | https://eko.fellou.ai/docs |
| 仓库 | https://github.com/FellouAI/eko |

**架构要点**

- `generate`：Planner LLM 产出 XML workflow（流式）。  
- `execute`：按 `dependsOn` 建 Agent 树，支持并行。  
- 每个 Agent 内是 ReAct + Tools；可挂 MCP。  
- 支持 pause / abort / snapshot、人机回调、Chat（4.0）。

**可借鉴**

- 计划与执行分离。  
- 依赖图并行。  
- 流式规划回调。  
- 人机确认与任务快照。

**不借鉴 / 需避免**

- 以 BrowserAgent 为默认一等公民。  
- XML 作为长期制品主格式（对业务团队与 Git review 不友好，YAML/代码更好）。  
- 把完整 Agent 框架当产品内核（与「Pi 内核」冲突）。  
- 前端直塞 API Key 的 demo 习惯。

**对 Helios 的含义：** Eko 是「自动化执行框架」。Helios 是「工作流编译器 + 可复现运行时」。相邻，不重合。

---

### 3.2 Pi（earendil-works/pi）

| 项 | 内容 |
|---|---|
| 定位 | 最小 Agent harness；可扩展，不为用户规定死工作流 |
| 包 | `pi-ai`、`pi-agent-core`、`pi-coding-agent`、`pi-tui` |
| 站点 | https://pi.dev/ |
| 仓库 | https://github.com/earendil-works/pi |
| 许可 | MIT |
| 默认工具 | read、bash、edit、write |

**能力**

- Interactive / Print-JSON / **RPC** / **SDK** 四种模式。  
- Skills、Extensions、Prompt templates、Packages。  
- Session 为树，可分支回退。  
- 多模型 provider。  
- 刻意不做：内置 MCP、sub-agent、permission popup、plan mode、todo、background bash。

**集成先例**

- OpenClaw 嵌入 Pi SDK（`createAgentSession`），自建权限、系统提示、消息网关。  
- 这证明：**业务产品应「拥有」编排与安全，Pi 只提供 loop。**

**风险**

- 默认权限等于启动用户权限，必须沙箱或 Helios 侧审批闸门。  
- 无内置 plan mode：Helios 必须自己做 compile 与制品。  
- RPC 适合 Go 调 Pi；SDK 嵌入更适合 TS 服务。若 control plane 是 Go，优先 **RPC 子进程或 sidecar**。

**对 Helios 的含义：** Pi = AI 节点与编译助手的执行脑。不负责 DAG 调度真相源。

---

### 3.3 编排与工作流引擎

| 产品 | 制品形态 | 强项 | 弱项（相对 Helios） |
|---|---|---|---|
| Temporal | 代码（Worker） | 耐久执行、长流程、强一致 | 无 NL 编译；上手重；不是业务 CLI 中心 |
| Kestra | YAML | IaC 式 flow、插件多；已加 AI Agent 任务 | AI 是插件，不是「编译出可复用业务资产」主叙事 |
| Prefect | Python | 数据/ML 友好 | 偏数据管道 |
| Windmill | 脚本 + DAG | 脚本即工具、UI 生成快 | 不是 NL→制品编译器 |
| n8n / Make / Zapier | 可视化 | 业务集成快 | 制品难当「代码资产」；AI 多为附加 |
| Dify / Coze | 可视化 AI 应用 | LLM 应用构建 | 偏对话应用，不是平台 CLI 操作内核 |
| LangGraph | 代码图 | Agent 状态机强 | 开发者框架，不是业务编译产品 |

**OpenClaw Workflow 插件**（YAML 多步 Agent pipeline）说明：社区已在「YAML + Agent 步骤 + 依赖/重试/resume」方向试水。Helios 差异应是 **步骤默认是 CLI，不是再开一个自由 Agent session**，以及 **Go 侧有正式契约与证据账本**。

---

### 3.4 Agent 友好 CLI / OpenAPI→CLI

这是 Helios「构造业务平台 CLI」的直接参照系。

| 项目 | 要点 | 启示 |
|---|---|---|
| [Lathe](https://github.com/lathe-cli/lathe) | OpenAPI/Swagger/proto → Cobra 单二进制；catalog；生成 Skills | Go 生成路径成熟；适合与 Helios Go 侧协同 |
| [FuseCLI](https://www.npmjs.com/package/@fusengine/fusecli) | OpenAPI→CLI；bundle；链接到 Claude/Cursor skills | 「Agent 调 bash 调 CLI」路径被验证 |
| [agent-ready](https://github.com/prajapatimehul/agent-ready) | dry-run、help-json、schema、MCP 生成 | 安全轨与 introspect 应进 Helios CLI 契约 |
| [Fern CLI](https://buildwithfern.com/post/generate-cli-from-openapi-spec) | 商业向 OpenAPI→CLI；JSON schema；dry-run | 市场认可「CLI 给 Agent 用」 |
| [ACLI](https://github.com/alpibrusl/acli) | Agent 友好 CLI 规范：introspect、exit code、dry-run、skill | **应优先对齐规范，而不是只对齐某一生成器** |

**推荐 Helios CLI 契约（综合上述）**

- `introspect` / `--help-json`：机器可读命令树  
- 默认或可切 `--output json`  
- 写操作支持 `--dry-run`  
- 语义化 exit code（成功 / 参数错 / 未找到 / 冲突 / dry-run 等）  
- auth 走本地 profile，不进 prompt  
- 可选生成 `SKILL.md` 供 Pi 加载  
- 每个 CLI 带 semver，workflow 可 pin 版本

---

### 3.5 GUI / RPA / 浏览器自动化

| 方向 | 代表 | 相对 Helios |
|---|---|---|
| 浏览器 Agent | Browser-use、Eko BrowserAgent | 强但难复现；适合兜底 |
| Playwright / CDP | 工程自动化主流 | 适合封装为少数 `gui.*` 工具 |
| 传统 RPA | UiPath 等 | 企业已有，但 Helios 不应做成录屏 RPA |

**策略结论：** GUI 是 **升舱路径**（CLI 失败、无 API、登录态人工协助），不是默认执行面。每次 GUI 步骤必须产证据（截图、选择器、时间、操作者）。

---

### 3.6 与 helios.ai 等产品形态参考

仓库 `docs/references.md` 将 https://helios.ai/ 记为产品形态参考（chat 建自动化、canvas、审计等）。本调研中的 Helios 是自有产品线，名称见 `docs/naming.md`，**不复制其代码与实现**。可参考的仅是「聊天构建 + 可运行工作流 + 审计」这类信息架构，而非功能清单照搬。

---

## 4. 竞品定位图

```text
                    更偏「每次 AI 现想」
                           ▲
                           │
          Eko / Browser-use / 纯 Coding Agent
                           │
     Dify ───────────── OpenClaw+YAML ─────────── n8n
                           │
                           │
     Kestra/Temporal ◄──── ★ Helios 目标 ────► Lathe/FuseCLI
     （人写制品）            │                （只造 CLI）
                           │
                           ▼
                    更偏「制品可复现」
```

**Helios 独特点组合（缺一不可）**

1. NL **编译** 出可版本化 workflow（不是只聊天执行）  
2. 执行面默认 **业务 CLI**（不是默认浏览器）  
3. 能 **生成/治理** 平台 CLI  
4. AI 内核用 **Pi**，编排与证据用 **Go**  
5. 制品可被 **其他 AI/流程调用**  
6. 复现：同制品 + 同参 + 同 CLI 版本 → 稳定路径；AI/GUI 节点显式标注并留证

---

## 5. 架构方案对比

### 方案 A：全 TypeScript（Pi + 自研编排）

- **优点：** 最快；Pi SDK 直嵌；CLI Factory 生成 TS 顺。  
- **缺点：** 与「Go 编译器」长期叙事弱；单二进制分发与强类型契约要另补。  
- **适用：** 2 周验证剧本。

### 方案 B：Go 编排 + Pi sidecar（推荐）

- **优点：** 契约、调度、审批、证据、exec CLI 在 Go；AI 编译与 AI 节点走 Pi RPC。  
- **缺点：** 双语仓库；进程边界与协议要设计。  
- **适用：** 产品化主路径。

### 方案 C：纯 Go Agent

- **优点：** 栈单一。  
- **缺点：** 放弃 Pi；自研 loop 成本高；与已定方向冲突。  
- **结论：** 否决。

### 方案 D：fork Eko 改造

- **优点：** 有现成 Planner/并行。  
- **缺点：** 浏览器中心难扭；与 Pi 重复；维护分叉贵。  
- **结论：** 否决。只做设计参照。

**决策建议：** 验证可用 A；产品主线用 B。现有仓库代码可重建，不强制兼容。

---

## 6. 关键风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| 无 OpenAPI 的老系统 | CLI 造不出来 | GUI 升舱 + 人工标注命令；半自动抓包辅助 |
| CLI 质量差 | Agent 乱调导致事故 | dry-run 默认、审批、allowlist、沙箱 |
| 复现期望过高 | GUI/AI 节点无法 bit 复现 | 契约写明：确定性节点 vs 非确定性节点 |
| Pi 权限过宽 | bash 可伤主机 | 容器 / 微 VM；Helios 拦截危险命令 |
| 生成器重复造轮子 | Lathe 等已存在 | 先定契约；MVP 可人工写 1 个 CLI，Factory 第二阶段 |
| 场景选错 | 通用平台无样可讲 | 必须钉死第一条业务剧本 |
| 与编排器正面竞争 | Temporal/Kestra 更成熟 | 不拼耐久集群；拼 NL 编译 + CLI 资产 + 证据 |

---

## 7. 对 PRD 的直接输入

1. **一句话：** Helios 是业务工作流编译器：自然语言生成可复用 YAML/代码工作流，默认通过平台 CLI 执行，必要时 GUI，AI 内核为 Pi，编排与证据为 Go。  
2. **MVP 不做：** 多租户 SaaS、可视化大编辑器、通用 MCP 市场、多 Agent 花活、替换 Temporal。  
3. **MVP 必做：** 制品模型、compile、execute、一个平台 CLI、一条剧本、审批、证据、`run_workflow` 给 AI 用。  
4. **CLI 契约对齐 ACLI/agent-ready 一类实践。**  
5. **第一条垂直场景仍为开放问题，必须在开工前选定。**

---

## 8. 参考链接

- Eko: https://github.com/FellouAI/eko  
- Eko Docs: https://eko.fellou.ai/docs  
- Pi: https://pi.dev/  
- Pi GitHub: https://github.com/earendil-works/pi  
- Armin Ronacher on Pi: https://lucumr.pocoo.org/2026/1/31/pi/  
- OpenClaw × Pi: https://openclawlab.com/en/docs/pi/  
- Lathe: https://github.com/lathe-cli/lathe  
- FuseCLI: https://www.npmjs.com/package/@fusengine/fusecli  
- agent-ready: https://github.com/prajapatimehul/agent-ready  
- ACLI: https://github.com/alpibrusl/acli  
- Fern OpenAPI CLI: https://buildwithfern.com/post/generate-cli-from-openapi-spec  
- Kestra AI Agents: https://kestra.io/blogs/introducing-ai-agents  
- OpenClaw workflow plugin: https://github.com/jerednel/openclaw-workflow  
- Helios naming: `docs/naming.md`

---

## 9. 调研假设（若错请改）

1. 产品名继续叫 Helios。  
2. 现有代码可推倒重来。  
3. 主执行面是业务 CLI，不是浏览器。  
4. Agent 内核固定为 Pi。  
5. Control plane 倾向 Go。  
6. 第一客户画像是「有多个业务后台、需要可审计自动化」的实施/运营/内部平台团队，不是个人爬虫用户。
