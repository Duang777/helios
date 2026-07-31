# Helios 产品需求文档（PRD）

**版本：** 0.1  
**日期：** 2026-07-31  
**状态：** 待评审  
**关联调研：** `docs/research/2026-07-31-helios-reposition-research.md`  
**命名：** 见 `docs/naming.md`（Helios = 通用工作流编译器与运行时）

---

## 0. 文档说明与假设

### 0.1 本文回答什么

Helios 做什么、不做什么、为谁做、MVP 做到什么算完、系统怎么分层、关键对象与接口长什么样。

### 0.2 明确假设（错了请直接改）

1. 产品名仍为 **Helios**。  
2. **现有仓库实现可忽略**，允许按本 PRD 重建。  
3. **AI 内核使用 Pi**（RPC 或 sidecar），不自研 Agent loop，不 fork Eko。  
4. **编排、编译校验、调度、审批、证据、CLI 进程管理用 Go**。  
5. 主执行面是 **业务平台 CLI**；GUI 是升舱与兜底。  
6. 工作流以 **可版本化制品**（YAML 为主，代码节点为辅）为一等公民。  
7. 第一条真实业务平台与剧本 **尚未选定**（见开放问题）。未选定前，MVP 可用「模拟平台 CLI」验收结构，但不能当作产品完成。

---

## 1. 愿景与定位

### 1.1 一句话

Helios 把自然语言业务目标编译成可复用、可复现、可被 AI 调用的工作流制品；执行时优先调用业务平台 CLI，必要时使用 GUI；AI 能力由 Pi 提供，编排与证据由 Go 运行时提供。

### 1.2 产品类别

**业务工作流编译器 + 可审计运行时**，不是：

- 通用聊天机器人  
- 浏览器 Agent 框架  
- 纯可视化 iPaaS  
- 数据管道编排器（Prefect/Airflow 替代品）

### 1.3 设计原则

1. **编译优先于闲聊。** 默认产出制品，再执行。  
2. **CLI 优先于 GUI。** GUI 必须说明原因并留证。  
3. **复现优先于聪明。** 同制品同参数应走稳定路径。  
4. **AI 使用制品，而不是复制 prompt。**  
5. **危险写操作默认可审批、可 dry-run。**  
6. **证据是一等对象，不是日志边角。**

---

## 2. 目标与非目标

### 2.1 目标（12 个月内）

| ID | 目标 | 度量 |
|---|---|---|
| G1 | NL 可生成可提交的 workflow 制品 | 生成后经人确认可合入 Git |
| G2 | 制品可重复执行 | 同一 YAML + 参数，确定性节点成功率 ≥ 95%（试点剧本） |
| G3 | 至少 1 个真实业务平台 CLI 可用 | ≥ 10 个命令，含查询与写入 |
| G4 | AI 可调用已发布 workflow | Pi 或外部 Agent 通过 tool/API 触发并拿到结构化结果 |
| G5 | 关键写操作可审批、可追溯 | 100% 标记为危险的步骤有审批记录或明确跳过策略 |
| G6 | GUI 仅用于升舱 | 试点剧本中 GUI 步骤占比有上限（目标 &lt; 30%，可按场景调整） |

### 2.2 非目标（明确不做）

- 替换 Temporal 做超大规模耐久工作流集群  
- 第一版做多租户公有云 SaaS  
- 内置完整 MCP 市场  
- 像素级克隆 Eko / helios.ai  
- 用 Go 重写 Pi  
- 第一版做完善可视化拖拽编辑器（可后续加；MVP 以制品 + 简单控制台为准）  
- 承诺 GUI/AI 节点 bit 级复现

---

## 3. 用户与场景

### 3.1 用户角色

| 角色 | 诉求 |
|---|---|
| 业务实施 / 运营专家 | 用自然语言描述流程，少写代码，能复跑 |
| 平台 / 集成工程师 | 维护 CLI、契约、权限、沙箱 |
| 审批人 / 负责人 | 危险动作可确认，事后可审计 |
| 上游 AI / 其他 Agent | 把已发布 workflow 当工具调用 |

### 3.2 核心 Job Stories

1. 当我有一个跨系统业务动作时，我希望说出目标后得到可保存的流程，以便下次不用重新教 AI。  
2. 当流程要写业务系统时，我希望先 dry-run 再审批，以便降低误操作。  
3. 当系统没有稳定 API 时，我希望偶尔用 GUI 完成，并留下截图证据，以便复核。  
4. 当我要接入新业务平台时，我希望尽快得到符合契约的 CLI，以便 Agent 与工作流都能用。  
5. 当另一个 Agent 需要同一能力时，我希望它调用 workflow ID，而不是抄一段 prompt。

### 3.3 MVP 样例剧本（占位，待替换为真实平台）

**名称：** `demo.lead-sync`（模拟）

1. 用 `demo-crm` CLI 按 ID 读取线索。  
2. 转换字段。  
3. 用 `demo-erp` CLI dry-run 创建单据。  
4. 人工审批。  
5. 真实创建。  
6. 若返回 `needs_gui`，打开 GUI 确认页并截图。  
7. 输出 run 证据包。

真实平台选定后，用真实 CLI 替换 demo CLI，剧本结构保持不变。

---

## 4. 核心概念

### 4.1 对象模型

| 对象 | 定义 |
|---|---|
| **Intent** | 自然语言目标、约束、成功标准（可易变） |
| **Workflow Artifact** | 可版本化定义（YAML 或代码入口），含参数 schema、步骤、依赖、策略 |
| **Platform CLI** | 某个业务系统的命令行工具，符合 Helios CLI 契约 |
| **Node / Step** | 制品中的一步：`cli` / `gui` / `ai` / `code` / `approval` |
| **Run** | 一次执行实例 |
| **Evidence** | 命令、stdout/stderr、exit code、审批、截图、人工备注等 |
| **Manifest** | 供 AI 发现的工作流元数据（名称、参数、副作用级别、所需 CLI 版本） |

### 4.2 生命周期

```text
Intent
  → Compile（Pi 辅助 + Go 校验）
  → Artifact（人可改，Git 可存）
  → Publish（生成 Manifest）
  → Execute（Go 调度；CLI/GUI/Pi）
  → Run + Evidence
  →（可选）Revise Artifact
```

### 4.3 复现语义

| 节点类型 | 复现承诺 |
|---|---|
| `cli`（无随机、无时间耦合） | 同参同 CLI 版本，结果应一致（允许业务数据变化导致业务层不同，但路径一致） |
| `approval` | 需人；复现时可变更为自动策略（显式配置） |
| `gui` | 尽力而为；必须留证；不承诺像素一致 |
| `ai` | 不承诺文本一致；必须记录模型、提示摘要、工具轨迹 |

「可复现」在 Helios 中首先指 **同一制品可再次执行且路径可控**，不是全程录像重放。

---

## 5. 功能需求

### 5.1 编译（Compile）

| ID | 需求 | 优先级 |
|---|---|---|
| F-C1 | 输入自然语言 Intent，输出 Workflow YAML 草稿 | P0 |
| F-C2 | 编译时只允许使用已注册的 CLI 命令与已声明的 gui/ai 能力 | P0 |
| F-C3 | Go 侧对 YAML 做 schema 校验、环依赖检测、参数引用检查 | P0 |
| F-C4 | 支持人修改 YAML 后重新校验 | P0 |
| F-C5 | 编译过程可流式展示「正在规划的步骤」（控制台） | P1 |
| F-C6 | 支持从失败 Run 触发「修订制品」而不是只重跑 | P1 |
| F-C7 | 可将复杂步骤编译为代码节点草稿（TS/Go 插件） | P2 |

**验收：** 给定固定 Intent 与固定 CLI 目录，连续两次编译在人工确认策略下能得到结构等价的制品（允许措辞差异；步骤集合与 CLI 命令集合应高度稳定）。MVP 可用「人确认后冻结制品」绕过模型不稳定性。

### 5.2 制品与发布

| ID | 需求 | 优先级 |
|---|---|---|
| F-A1 | Workflow 以文件存盘；支持 Git | P0 |
| F-A2 | 每个 workflow 有 `id`、`version`、`params` schema | P0 |
| F-A3 | Publish 后生成 Manifest，供 AI/API 发现 | P0 |
| F-A4 | 支持 `include` / `call` 其他 workflow（子流程） | P1 |
| F-A5 | 制品可导出为「只读工具描述」给 Pi skill | P1 |

### 5.3 执行（Execute）

| ID | 需求 | 优先级 |
|---|---|---|
| F-E1 | 按依赖图调度；无依赖可并行 | P0 |
| F-E2 | `cli` 节点：组装 argv、注入参数、捕获输出、写 Evidence | P0 |
| F-E3 | 写操作支持先 `--dry-run` 再执行的策略 | P0 |
| F-E4 | `approval` 节点阻塞等待；超时策略可配 | P0 |
| F-E5 | pause / resume / abort | P0 |
| F-E6 | `gui` 节点仅在条件满足或显式声明时运行 | P1 |
| F-E7 | `ai` 节点通过 Pi RPC/sidecar 执行，结果回写变量 | P0 |
| F-E8 | 失败可从指定步骤 resume（需声明幂等或补偿策略） | P1 |

### 5.4 平台 CLI 与 CLI Factory

| ID | 需求 | 优先级 |
|---|---|---|
| F-L1 | 定义 Helios CLI 契约（introspect、json、dry-run、exit code、auth profile） | P0 |
| F-L2 | CLI Registry：注册名称、版本、二进制路径、能力清单 | P0 |
| F-L3 | MVP 提供至少 1 个符合契约的真实或模拟平台 CLI | P0 |
| F-L4 | CLI Factory：OpenAPI/手写规格 → 生成 CLI 脚手架 | P1 |
| F-L5 | 生成 `SKILL.md` 供 Pi 使用 | P1 |
| F-L6 | 支持无 OpenAPI 时的半自动命令标注流程 | P2 |

### 5.5 GUI Operator

| ID | 需求 | 优先级 |
|---|---|---|
| F-G1 | 提供最小 GUI 工具集：open、click、type、extract、screenshot | P1 |
| F-G2 | GUI 步骤强制截图证据 | P1 |
| F-G3 | 登录类操作支持 `human_help` | P1 |
| F-G4 | 选择器与稳定策略可配置；禁止把整段浏览器 Agent 当默认 | P0（原则） |

### 5.6 AI 使用制品

| ID | 需求 | 优先级 |
|---|---|---|
| F-I1 | API：`list_workflows`、`get_manifest`、`run_workflow`、`get_run` | P0 |
| F-I2 | Pi 可通过 skill/tool 调用已发布 workflow | P0 |
| F-I3 | 调用方只能看到 Manifest 声明的参数与副作用级别 | P0 |
| F-I4 | 支持同步等待与异步 run id 两种模式 | P1 |

### 5.7 证据与审计

| ID | 需求 | 优先级 |
|---|---|---|
| F-V1 | 每个步骤写入 Evidence（开始/结束时间、类型、输入摘要、输出摘要、状态） | P0 |
| F-V2 | CLI 保留脱敏后的 stdout/stderr 与 exit code | P0 |
| F-V3 | 审批人、时间、决定写入 Evidence | P0 |
| F-V4 | Run 可导出证据包（目录或 zip） | P1 |
| F-V5 | 密钥与 token 不明文入库 | P0 |

### 5.8 控制台（最小）

| ID | 需求 | 优先级 |
|---|---|---|
| F-U1 | 编译对话 / 粘贴 Intent | P0 |
| F-U2 | 查看与编辑 YAML（可用 Monaco 或外置编辑器） | P0 |
| F-U3 | 发起 Run、看步骤状态、审批 | P0 |
| F-U4 | 查看 Evidence | P0 |
| F-U5 | CLI Registry 列表 | P1 |

UI 原则：工具台密度优先，不做营销落地页。

---

## 6. 非功能需求

| ID | 类别 | 要求 |
|---|---|---|
| N1 | 安全 | 默认拒绝未注册 CLI；危险命令需审批策略 |
| N2 | 隔离 | Pi 与 CLI 执行建议容器化；至少文档给出 Docker 方案 |
| N3 | 可观测 | Run 状态可查询；关键日志结构化 |
| N4 | 性能 | 本地单机 MVP：10 步以内 CLI 工作流调度开销可忽略（秒级） |
| N5 | 兼容 | Workflow schema 版本化；破坏性变更走 version bump |
| N6 | 许可 | 自研代码许可待定；依赖优先 MIT/Apache；引入前记录 |

---

## 7. 系统架构

### 7.1 逻辑架构

```text
┌─────────────────────────────────────────────┐
│                 Console (Web)               │
└──────────────────────┬──────────────────────┘
                       │ HTTP/API
┌──────────────────────▼──────────────────────┐
│              Helios Control Plane (Go)      │
│  Compiler Validate · Scheduler · Approvals  │
│  Registry · Evidence Store · Run API        │
└───────┬──────────────────────────┬──────────┘
        │ exec                     │ RPC/HTTP
        ▼                          ▼
┌───────────────┐          ┌──────────────────┐
│ Platform CLIs │          │ Pi Sidecar (TS)  │
│ (business)    │          │ compile assist · │
└───────────────┘          │ ai nodes · factory│
        ▲                  └─────────┬────────┘
        │                            │
┌───────┴────────┐                   │
│ GUI Operator   │◄──────────────────┘
│ (Playwright等) │   （仅升舱）
└────────────────┘
```

### 7.2 模块职责

| 模块 | 语言 | 职责 |
|---|---|---|
| `compiler` | Go + Pi | NL→YAML；Go 做校验与规范化 |
| `runtime` | Go | DAG 调度、状态机、pause/abort |
| `cli-runner` | Go | 进程执行、超时、输出采集 |
| `pi-sidecar` | TS | 编译辅助、ai 节点、CLI Factory 智能部分 |
| `gui-operator` | TS（建议） | Playwright 封装 |
| `registry` | Go | CLI 与 Workflow 注册 |
| `evidence` | Go | 证据持久化 |
| `console` | React | 操作台 |

### 7.3 与 Eko / Pi 的边界

- **不嵌入 Eko 运行时。**  
- **不把 Pi 当全局编排器。** Pi 只处理被指派的 AI 工作。  
- OpenClaw「嵌入 Pi、自建外围」是集成参考，不是产品复制对象。

---

## 8. 制品格式（草案）

### 8.1 Workflow YAML（MVP）

```yaml
apiVersion: helios/v1
kind: Workflow
id: demo.lead-sync
version: 1
description: Sync a CRM lead into ERP purchase order
params:
  lead_id:
    type: string
    required: true
requires:
  clis:
    - name: demo-crm
      version: ">=1.0.0"
    - name: demo-erp
      version: ">=1.0.0"
steps:
  - id: fetch_lead
    uses: cli
    cli: demo-crm
    argv: ["leads", "get", "--id", "${params.lead_id}", "--output", "json"]
    out: lead

  - id: create_po_dry
    uses: cli
    needs: [fetch_lead]
    cli: demo-erp
    argv: ["po", "create", "--from-json", "${lead}", "--dry-run", "--output", "json"]
    out: dry

  - id: approve
    uses: approval
    needs: [create_po_dry]
    prompt: "Create PO for lead ${params.lead_id}?"

  - id: create_po
    uses: cli
    needs: [approve]
    cli: demo-erp
    sideEffect: write
    argv: ["po", "create", "--from-json", "${lead}", "--output", "json"]
    out: po

  - id: gui_confirm
    uses: gui
    needs: [create_po]
    when: "${po.needs_gui} == true"
    action: screenshot_and_confirm
    out: gui_result
```

### 8.2 Manifest（AI 可见）

```yaml
id: demo.lead-sync
version: 1
title: Sync CRM lead to ERP PO
params:
  lead_id: { type: string, required: true }
sideEffectLevel: write
requiresApprovals: true
clis: [demo-crm, demo-erp]
```

---

## 9. CLI 契约（MVP 必须）

每个注册到 Helios 的 CLI 应支持：

1. `introspect` 或等价 `--help-json`：返回命令树与参数 schema。  
2. 业务命令支持 `--output json`（或默认 JSON）。  
3. 写命令支持 `--dry-run`。  
4. 非 0 exit code 有稳定语义（至少区分：参数错误、未找到、冲突、权限、内部错误）。  
5. 认证通过环境变量或本地 profile，不要求把密钥写进 argv。  
6. 版本命令：`--version`。

推荐对齐社区实践（ACLI / agent-ready），但 Helios 以自有校验器为准。

---

## 10. API（MVP）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/compile` | Intent → workflow 草稿 |
| POST | `/api/v1/workflows/validate` | 校验 YAML |
| POST | `/api/v1/workflows/{id}/publish` | 发布 Manifest |
| GET | `/api/v1/workflows` | 列表 |
| GET | `/api/v1/workflows/{id}` | 详情 + Manifest |
| POST | `/api/v1/workflows/{id}/runs` | 创建 Run |
| GET | `/api/v1/runs/{runId}` | Run 状态与步骤 |
| POST | `/api/v1/runs/{runId}/approval` | 审批 |
| POST | `/api/v1/runs/{runId}/pause` | 暂停 |
| POST | `/api/v1/runs/{runId}/abort` | 中止 |
| GET | `/api/v1/runs/{runId}/evidence` | 证据 |
| GET | `/api/v1/clis` | CLI Registry |

具体 JSON schema 在实现前另开 `docs/api/` 合同文件；本 PRD 定能力边界。

---

## 11. 安全与权限

1. **Allowlist：** 只能执行 Registry 中的 CLI 与声明过的子命令（可按 workflow 收紧）。  
2. **审批策略：** `sideEffect: write` 默认需要 approval，除非 workflow 显式 `autoApprove`（仅限受控环境）。  
3. **密钥：** 存 OS keychain / 环境注入；Evidence 脱敏。  
4. **Pi：** 无内置权限模型；由 Helios 决定是否允许 bash、是否容器化。  
5. **审计：** 谁在何时编译、发布、执行、审批，必须可查。

---

## 12. 成功指标

### 12.1 MVP 完成定义

同时满足：

1. 可用自然语言编译出合法 YAML，并手动小改后通过校验。  
2. 一条试点剧本端到端跑通（CLI + 审批 + 证据）。  
3. 同一制品用相同参数再跑一次，确定性步骤路径一致。  
4. 通过 API 或 Pi skill 触发 `run_workflow` 成功。  
5. 有 CLI 契约文档与至少一个符合契约的 CLI。  
6. 有本 PRD 对应的架构说明与至少 1 条 ADR（Go+Pi 边界）。

### 12.2 产品早期指标（试点客户）

- 从 Intent 到可复跑制品的中位耗时  
- 复跑成功率  
- 人工审批平均等待  
- GUI 步骤占比  
- 因页面变更导致的失败次数（相对纯 RPA 应更低）

---

## 13. 里程碑

### M0：契约冻结（1 周）

- 冻结 Workflow schema v1  
- 冻结 CLI 契约 v1  
- 选定第一条真实平台或确认用 demo CLI 起步  
- 写入 ADR：Go control plane + Pi sidecar

### M1：可执行内核（2–3 周）

- Go：validate、scheduler、cli-runner、run/evidence API  
- 模拟或真实 CLI ×1  
- 无 UI 也可用 curl 跑通

### M2：编译与 Pi（2 周）

- Pi sidecar：NL→YAML 草稿  
- 校验闭环  
- ai 节点最小实现

### M3：控制台与审批（2 周）

- 最小控制台：编译、编辑、运行、审批、证据  
- pause/abort

### M4：GUI 升舱 + AI 调用（2 周）

- GUI operator 最小集  
- Manifest + Pi skill `run_workflow`

### M5：CLI Factory v0（2–3 周）

- OpenAPI→脚手架或接入 Lathe/FuseCLI 一类工具  
- 注册进 Registry

**合计约 10–12 周到可对外演示的垂直闭环。** 真实平台复杂度可能拉长 M1/M5。

---

## 14. 开放问题（必须关闭后才能称产品定稿）

| # | 问题 | 影响 |
|---|---|---|
| Q1 | 第一条真实业务平台与剧本是什么？ | 决定 CLI 设计与 demo 说服力 |
| Q2 | Workflow 主语言长期是否坚持 YAML，还是 YAML+TS 双主？ | 影响编译器与用户技能模型 |
| Q3 | Pi 集成用 RPC 子进程还是长期 TS 微服务？ | 部署形态 |
| Q4 | 证据默认本地文件还是 DB？ | 运维与检索 |
| Q5 | 目标部署：仅本地单机，还是内网服务？ | 安全模型 |
| Q6 | 开源策略与品牌边界（相对 helios.ai 名称） | 法务与传播 |

---

## 15. 验收检查清单（MVP）

- [ ] Intent → YAML 草稿可生成  
- [ ] YAML 校验（schema、依赖、参数）通过/失败信息明确  
- [ ] CLI Registry 可注册并执行 allowlist 命令  
- [ ] dry-run → approval → write 路径可跑  
- [ ] Run 证据可查看  
- [ ] 同制品同参复跑，cli 步骤顺序稳定  
- [ ] `run_workflow` API 可用  
- [ ] Pi 能触发一次已发布 workflow  
- [ ] 文档：CLI 契约、schema、ADR、本 PRD 已对齐  
- [ ] 明确记录「不做列表」未被偷偷做大

---

## 16. 附录：术语

| 术语 | 含义 |
|---|---|
| 制品 / Artifact | 可版本化的 workflow 定义文件 |
| 升舱 | 从 CLI 路径切换到 GUI 路径 |
| Manifest | 给 AI/调用方看的工作流说明书 |
| Sidecar | 与 Go 主进程协作的 Pi 进程 |
| dry-run | 不产生业务副作用的预演执行 |

---

## 17. 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| 0.1 | 2026-07-31 | 首版：基于产品讨论与外部调研落稿 |
