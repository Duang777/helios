# Helios 实现设计 v0.1

**日期：** 2026-07-31  
**状态：** 设计草案（PRD 配套）  
**关联：** `docs/prd/helios-prd-v0.1.md`、`docs/decisions/ADR-001-go-control-plane-pi-sidecar.md`  
**前提：** 现有 `backend/` 领域模型偏旧（llm_task / form / app pages），本设计按 PRD **重建模块边界**；可复用进程骨架与测试习惯，不要求兼容旧 JSON 形状。

---

## 0. 总览：依赖顺序

实现必须按依赖自底向上，垂直切片交付：

```text
1. schema + domain types
2. CLI contract + demo CLIs + registry + cli-runner
3. runtime DAG（cli + approval）+ evidence
4. HTTP API + store
5. pi-sidecar（compile assist + ai node）
6. console（compile / edit / run / approve）
7. gui-operator
8. CLI factory
9. AI-facing manifest / run_workflow skill
```

第一条可演示闭环：**固定 YAML → CLI 执行 → 审批 → 证据**。NL 编译可以第二刀再接。

---

## 1. 仓库布局（目标）

```text
helios/
  backend/                         # Go control plane
    cmd/helios/                    # API server
    cmd/helios-cli/                # local admin: validate, run, register-cli
    internal/
      domain/                      # Workflow, Step, Run, Evidence, Manifest
      schema/                      # YAML load + JSON Schema validate
      expr/                        # ${...} 插值与 when 条件
      registry/                    # CLI + Workflow registry
      clirunner/                   # exec allowlist, timeout, capture
      runtime/                     # DAG scheduler + step handlers
      approval/                    # blocking approval store
      evidence/                    # evidence writer + redaction
      compile/                     # calls Pi, then validate
      pi/                          # Pi RPC client (Go)
      guiclient/                   # HTTP client to gui-operator
      store/                       # filesystem MVP (later SQLite)
      httpapi/                     # REST
  packages/
    pi-sidecar/                    # Node: compile prompt, ai node, factory assist
    gui-operator/                  # Playwright thin server
    demo-crm-cli/                  # sample platform CLI
    demo-erp-cli/
  workflows/                       # checked-in artifacts
    demo.lead-sync.yaml
  contracts/
    workflow.schema.json
    cli-introspect.schema.json
    api.openapi.yaml
  web/                             # console
  docs/
  tasks/
```

---

## 2. Domain 与 Schema

### 2.1 Go 类型（核心）

```go
type Workflow struct {
    APIVersion string            `yaml:"apiVersion" json:"apiVersion"` // helios/v1
    Kind       string            `yaml:"kind" json:"kind"`             // Workflow
    ID         string            `yaml:"id" json:"id"`
    Version    int               `yaml:"version" json:"version"`
    Description string           `yaml:"description" json:"description"`
    Params     map[string]Param  `yaml:"params" json:"params"`
    Requires   Requires          `yaml:"requires" json:"requires"`
    Steps      []Step            `yaml:"steps" json:"steps"`
}

type Step struct {
    ID         string         `yaml:"id" json:"id"`
    Uses       StepUses       `yaml:"uses" json:"uses"` // cli|gui|ai|approval|code
    Needs      []string       `yaml:"needs" json:"needs"`
    When       string         `yaml:"when,omitempty" json:"when,omitempty"`
    Out        string         `yaml:"out,omitempty" json:"out,omitempty"`
    SideEffect SideEffect     `yaml:"sideEffect,omitempty" json:"sideEffect,omitempty"` // none|read|write

    // cli
    CLI   string   `yaml:"cli,omitempty" json:"cli,omitempty"`
    Argv  []string `yaml:"argv,omitempty" json:"argv,omitempty"`

    // approval
    Prompt string `yaml:"prompt,omitempty" json:"prompt,omitempty"`

    // gui
    Action string         `yaml:"action,omitempty" json:"action,omitempty"`
    GUI    map[string]any `yaml:"gui,omitempty" json:"gui,omitempty"`

    // ai
    AIPrompt string `yaml:"aiPrompt,omitempty" json:"aiPrompt,omitempty"`
    AIModel  string `yaml:"aiModel,omitempty" json:"aiModel,omitempty"`
}
```

Run 状态机：

```text
PENDING → RUNNING → WAITING_APPROVAL → RUNNING → COMPLETED
                 ↘ FAILED
                 ↘ ABORTED
                 ↘ PAUSED
```

Step 状态：`PENDING | READY | RUNNING | WAITING_APPROVAL | SKIPPED | COMPLETED | FAILED | ABORTED`

### 2.2 JSON Schema 校验

- 文件：`contracts/workflow.schema.json`
- Go 用 `santhosh-tekuri/jsonschema` 或先 YAML→map→JSON 再校验
- 额外语义检查（schema 做不到的）放 `schema.SemanticValidate`：
  - step id 唯一
  - `needs` 无环、引用存在
  - `cli` 步骤的 `cli` 名在 `requires.clis` 中
  - `out` 名不冲突
  - `when` 表达式可解析
  - `sideEffect: write` 若全局策略要求，前面必须有 approval 或显式 `autoApprove`

### 2.3 表达式 `${...}`

MVP 只支持：

- `${params.x}`
- `${varname}`（某步 `out` 的整段 JSON）
- `${varname.field.sub}`（JSON path，点号）
- 字符串拼接出现在 argv 元素内

`when` MVP：

- `${varname.field} == true`
- `${varname.field} != ""`
- 字面量 `true` / `false`

实现：`expr.EvalString(template, scope)` / `expr.EvalBool(when, scope)`。  
不要引入完整 CEL/JQ，等真有需要再加。

大对象进 argv 时：若值是 object/array，默认 `json.Marshal` 成单参数；避免把巨型 JSON 嵌进多个 flag。

---

## 3. CLI 契约与 demo CLI

### 3.1 Introspect 响应形状

```json
{
  "name": "demo-crm",
  "version": "1.0.0",
  "commands": [
    {
      "path": ["leads", "get"],
      "sideEffect": "read",
      "args": [
        {"name": "--id", "type": "string", "required": true},
        {"name": "--output", "type": "string", "enum": ["json", "text"], "default": "json"}
      ],
      "dryRun": false
    },
    {
      "path": ["leads", "update"],
      "sideEffect": "write",
      "dryRun": true,
      "args": [...]
    }
  ]
}
```

命令：`demo-crm introspect` 打印上述 JSON 到 stdout。

### 3.2 Exit code（建议）

| Code | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 参数错误 |
| 3 | 未找到 |
| 5 | 冲突 |
| 7 | 权限 |
| 9 | dry-run 成功（无副作用） |
| 1 | 其他错误 |

Runtime 把 9 视为成功（dry-run）。

### 3.3 demo-crm / demo-erp 实现细节

- 语言：Go 或 Node 均可；为省双语摩擦，**建议 Go cobra**，与 Lathe 方向一致。
- 持久化：本地 `~/.helios/demo-crm.json` 文件 DB。
- 必须命令：
  - crm: `leads get|list|create|update`
  - erp: `po get|create`（create 支持 `--dry-run`；可返回 `{needs_gui: true}` 模拟升舱）
- 输出：默认 JSON envelope：

```json
{"ok": true, "command": "leads.get", "data": {...}, "meta": {"cli": "demo-crm", "version": "1.0.0"}}
```

### 3.4 Registry

磁盘：

```text
~/.helios/registry/clis/
  demo-crm.json   # {name, version, path, introspectCache, registeredAt}
```

注册流程：

1. `helios-cli clis register --name demo-crm --path $(which demo-crm)`
2. 执行 `path introspect`
3. 校验 introspect schema
4. 写入 registry

运行时解析：`name → absolute path + version pin 检查`。

Allowlist：workflow 里出现的 `(cli, argv[0..n])` 必须匹配 introspect 的某条 `path` 前缀；禁止任意 bash。

---

## 4. CLI Runner（Go）

### 4.1 接口

```go
type RunRequest struct {
    CLIName    string
    Argv       []string          // 不含二进制名
    Env        map[string]string // 合并，不含密钥明文日志
    WorkDir    string
    Timeout    time.Duration
    MaxStdout  int64             // 默认 2MiB
    MaxStderr  int64
}

type RunResult struct {
    ExitCode int
    Stdout   []byte
    Stderr   []byte
    Duration time.Duration
    Truncated bool
}
```

### 4.2 实现要点

- `exec.CommandContext` + timeout cancel
- 启动前：registry 解析 + allowlist 校验
- 环境：继承最小集合 + `HELIOS_RUN_ID` + profile 注入（如 `DEMO_CRM_TOKEN` 从 keyring/env 文件读）
- stdout/stderr 环形截断，超限打 `Truncated=true`
- 脱敏：Evidence 写入前对已知密钥模式与 `Authorization` 类字符串替换
- **不**用 shell；argv 数组直传，避免注入

### 4.3 解析 CLI 输出

约定 stdout 最后一段是 JSON（或整段 JSON）。  
`json.Unmarshal` 失败 → step FAILED，stderr 进证据。  
成功则把对象放进 scope[`out`]。

---

## 5. Runtime / Scheduler

### 5.1 算法

1. 加载 Workflow + params → 初始 scope  
2. 建邻接：`needs` → 依赖图；检测环  
3. 循环：
   - 找出所有依赖已完成且未跳过的 PENDING 步 → READY  
   - 对 READY 评估 `when`；false → SKIPPED  
   - WAITING_APPROVAL 的步不自动推进  
   - 其余 READY 按并行策略执行：
     - MVP：`maxParallel = 4`，同层无依赖可并行
     - `approval` / `gui` / `ai` 建议串行（简单）
4. 任一步 FAILED 且未标记 `continueOnError` → Run FAILED  
5. 全部终态 → COMPLETED

### 5.2 Step handlers

| uses | handler |
|---|---|
| cli | interpolate argv → clirunner → parse JSON → scope |
| approval | 创建 Approval 记录 → Run=WAITING_APPROVAL → 等 API |
| gui | HTTP 调 gui-operator → 存截图路径到 evidence |
| ai | Pi RPC prompt → 解析约定 JSON block → scope |
| code | MVP 可延后；或只支持预编译 Go plugin / 外部脚本白名单 |

### 5.3 暂停 / 中止

- `pause`：设标志，当前步跑完后不再调度新步  
- `abort`：cancel context，杀进程组（`Setpgid` / `Kill`）  
- `resume`：清 pause，继续调度

### 5.4 审批恢复

```text
POST /runs/{id}/approval { "stepId": "approve", "decision": "approve"|"reject", "actor": "..." }
```

- approve：该步 COMPLETED，继续  
- reject：该步 FAILED，Run FAILED  

### 5.5 与旧 runtime 的关系

旧 `runtime.go` 是同步一次跑完、节点类型不同。建议 **新建包路径或大幅改写**，保留测试风格（表驱动 + 内存 store），不要硬兼容旧 `NodeTypeLLMTask`。

---

## 6. Evidence

### 6.1 存储（MVP：文件系统）

```text
~/.helios/runs/{runId}/
  run.json                 # 状态摘要
  steps/{stepId}.json      # 逐步结果
  evidence/
    {seq}-{stepId}.json    # 元数据
    {seq}-{stepId}.stdout.txt
    {seq}-{stepId}.stderr.txt
    {seq}-{stepId}.png     # gui
  approvals/{stepId}.json
```

### 6.2 Evidence 记录字段

```json
{
  "id": "ev_...",
  "runId": "...",
  "stepId": "fetch_lead",
  "type": "cli",
  "startedAt": "...",
  "endedAt": "...",
  "status": "COMPLETED",
  "inputSummary": {"cli": "demo-crm", "argv": ["leads","get","--id","L1"]},
  "exitCode": 0,
  "stdoutRef": "evidence/001-fetch_lead.stdout.txt",
  "stderrRef": "evidence/001-fetch_lead.stderr.txt",
  "outputSummary": {"ok": true, "keys": ["data"]}
}
```

密钥脱敏在写文件前做。stdout 可再存一份 `redacted`。

---

## 7. Store

MVP 不做 Postgres。

```go
type Store interface {
    SaveWorkflow(wf Workflow) error
    GetWorkflow(id string) (Workflow, error)
    ListWorkflows() ([]WorkflowMeta, error)
    Publish(id string, manifest Manifest) error
    CreateRun(run Run) error
    UpdateRun(run Run) error
    GetRun(id string) (Run, error)
    SaveApproval(...) error
}
```

实现：`store/fs` 映射到 `~/.helios/`。  
单机文件锁：`flock` 或按 runId 分文件避免并发写同一 run。

---

## 8. Compiler（NL → YAML）

### 8.1 两段式

1. **Pi draft：** 给定 Intent + 已注册 CLI introspect 摘要 → 产出 YAML 文本  
2. **Go validate：** schema + semantic；失败则把错误回灌 Pi 最多 N 次（默认 2）

### 8.2 给 Pi 的上下文（必须可控）

- 系统说明：只许使用列出的 CLI 命令；输出只能是一个 `helios/v1` YAML 代码块  
- 附：每个 CLI 的 introspect **压缩版**（命令 path + sideEffect + 必要 args）  
- 附：示例 workflow（`demo.lead-sync`）  
- 禁止：发明未注册 CLI；禁止随意 `bash`

### 8.3 Go ↔ Pi 协议

**推荐 MVP：** Go 起子进程 `pi --mode rpc`，JSONL stdin/stdout。

流程：

1. `new_session`（可 `--no-session` 或独立 session-dir per compile）  
2. `prompt` 发送编译请求  
3. 订阅事件直到 agent idle  
4. 从最终 assistant 消息提取 ```yaml ... ```  
5. `abort` / 结束进程

注意：Pi RPC 要求 **严格按 `\n` 分帧**；Go 用 bufio 按 byte `\n` 切，不要用会切开 U+2028 的 reader。

备选：`packages/pi-sidecar` 提供 HTTP：

- `POST /compile` `{intent, clis: [...]}` → `{yaml, rawTraceId}`  
- `POST /ai-step` `{prompt, context}` → `{json}`

HTTP sidecar 对调试更友好；RPC 少一个常驻服务。建议：

- 开发期：sidecar HTTP  
- 集成测试两种都测  
- 产品默认 sidecar（易加鉴权与超时）

### 8.4 编译 API

```http
POST /api/v1/compile
{
  "intent": "把线索 L-123 同步成采购单，写前要审批",
  "hints": {"preferCli": true}
}
→
{
  "yaml": "...",
  "validation": {"ok": true, "errors": []},
  "warnings": ["step create_po is write; approval present"]
}
```

校验失败仍返回 yaml 草稿 + errors，方便控制台展示。

---

## 9. Pi Sidecar（TS）详细职责

### 9.1 服务

```text
packages/pi-sidecar/
  src/server.ts          # HTTP
  src/compile.ts         # prompt templates + parse yaml fence
  src/aiStep.ts          # constrained JSON out
  src/factory.ts         # openapi → draft command list (later)
  src/piSession.ts       # wrap AgentSession or RPC client
```

### 9.2 ai 节点约定

Go 发给 sidecar：

```json
{
  "runId": "...",
  "stepId": "normalize",
  "prompt": "Map CRM lead JSON to ERP PO fields",
  "input": {"lead": {...}},
  "outputSchema": {"type":"object","required":["poDraft"]}
}
```

Sidecar 要求模型只输出 JSON；用 schema 校验后返回。  
失败重试 1 次；仍失败 → step FAILED。

### 9.3 工具限制

Compile / ai-step session **默认关闭随意 bash** 或只允许 `helios-cli` / 只读 cat introspect 缓存。  
实现方式：Pi extension 的 `beforeToolCall` 拦截，或给专用 skill 而不给通用 bash。  
这是安全关键点，MVP 就必须有。

---

## 10. GUI Operator

### 10.1 服务

`packages/gui-operator`：本地 Playwright，HTTP：

| 路径 | 作用 |
|---|---|
| POST `/v1/open` | `{url}` → `{sessionId}` |
| POST `/v1/click` | `{sessionId, selector}` |
| POST `/v1/type` | `{sessionId, selector, text}` |
| POST `/v1/extract` | `{sessionId, selector}` → text |
| POST `/v1/screenshot` | → png bytes / path |
| POST `/v1/actions/screenshot_and_confirm` | 组合动作 |
| POST `/v1/human_help` | 阻塞等人工（websocket 或轮询） |

### 10.2 Workflow 映射

```yaml
- id: gui_confirm
  uses: gui
  when: "${po.needs_gui} == true"
  action: screenshot_and_confirm
  gui:
    url: "${po.confirmUrl}"
    selector: "button[type=submit]"
```

Go `guiclient` 调 operator，把截图写入 evidence 目录，返回 `{ok, screenshotPath}`。

### 10.3 原则

- 选择器写在制品里，不靠模型当场瞎点（模型只在 compile 时写选择器）  
- 超时短；失败升舱到 `human_help`  
- 不把完整 Browser Agent 塞进 runtime

---

## 11. HTTP API 实现细节

### 11.1 服务结构

```go
// chi or stdlib mux
POST /api/v1/compile
POST /api/v1/workflows/validate
PUT  /api/v1/workflows/{id}          // save yaml body
POST /api/v1/workflows/{id}/publish
GET  /api/v1/workflows
GET  /api/v1/workflows/{id}
POST /api/v1/workflows/{id}/runs     // {params}
GET  /api/v1/runs/{runId}
POST /api/v1/runs/{runId}/approval
POST /api/v1/runs/{runId}/pause
POST /api/v1/runs/{runId}/resume
POST /api/v1/runs/{runId}/abort
GET  /api/v1/runs/{runId}/evidence
GET  /api/v1/clis
POST /api/v1/clis/register
GET  /api/v1/health
```

### 11.2 Run 执行模型

- API 创建 Run 后 **异步** 跑 scheduler（goroutine）  
- 查询 `GET run` 返回当前状态  
- WAITING_APPROVAL 时 scheduler 阻塞在 channel / store 轮询  
- 前端 1s 轮询或后续 SSE

### 11.3 错误形状

```json
{"error": {"code": "VALIDATION_FAILED", "message": "...", "details": [...]}}
```

---

## 12. Console（Web）

### 12.1 信息架构（三栏）

1. **左：** Workflow 列表 + CLI registry  
2. **中：** Intent 编译 / YAML 编辑器（Monaco）  
3. **右：** Run 时间线 + Approval + 审批按钮  

不做营销首页；密度参考现有工具台，但数据模型按新 API。

### 12.2 关键交互

- Compile → 中栏填 YAML → Validate 高亮错误  
- Save / Publish  
- Run：填 params 表单（由 params schema 生成）  
- 审批：WAITING 时右侧大按钮  
- Evidence：点步骤看 stdout / 截图  

类型：`web/src/api/types.ts` 与 OpenAPI 同步。

---

## 13. Manifest 与 AI 调用

### 13.1 Publish

从 Workflow 推导：

- `sideEffectLevel = max(steps.sideEffect)`  
- `requiresApprovals = 存在 approval 或 write`  
- params schema 原样暴露  

写入 `~/.helios/manifests/{id}.json`

### 13.2 Pi Skill

`skills/helios-run-workflow/SKILL.md`：

- 先 `curl GET /api/v1/workflows` 选 id  
- `POST /runs` 带 params  
- 轮询到终态  
- 只准用 Manifest 里的参数名  

也可在 sidecar 注册 tool `run_workflow`，内部调 Go API。

---

## 14. CLI Factory（第二阶段细节）

输入：OpenAPI URL/文件 + 平台名  
输出：

```text
packages/{name}-cli/
  main.go / package.json
  introspect 实现
  SKILL.md
  README
```

路径选择：

1. MVP：手写 demo CLI 证明契约  
2. 下一刀：壳脚本调用 Lathe 或 FuseCLI，再 **后处理** 补 Helios exit code / envelope  
3. 自研生成器仅在现成工具不够时启动  

Factory 的「智能」部分（映射资源名、合并重复 endpoint）放 Pi；机械 codegen 放确定工具。

---

## 15. 安全实现清单（MVP 必须落地）

| 项 | 做法 |
|---|---|
| 无任意 shell | cli-runner 不用 `/bin/sh -c` |
| Allowlist | registry introspect 前缀匹配 |
| 密钥 | env/profile；evidence 脱敏 |
| Pi bash | compile/ai session 拦截 |
| 超时 | 每步默认 60s，可配 |
| 输出上限 | 2MiB |
| 审批 | write 默认要 approval（策略开关） |
| 路径 | screenshot/workdir 限制在 helios home 下 |

---

## 16. 测试策略

| 层 | 测什么 |
|---|---|
| unit | expr、schema semantic、allowlist、脱敏 |
| integration | demo CLI + runtime 跑 `demo.lead-sync`（无 Pi） |
| integration | approve 中断与恢复 |
| contract | introspect / workflow JSON schema 样例 |
| optional e2e | compile 用 mock Pi（返回固定 YAML） |
| console | 组件测次要；先 API 契约稳定 |

TDD 建议顺序：先写 `TestLeadSyncDeterministicPath`（同一 YAML 两次 run，step 顺序与 cli argv 一致）。

---

## 17. 配置

`~/.helios/config.yaml`：

```yaml
dataDir: ~/.helios
apiAddr: "127.0.0.1:8787"
piSidecarURL: "http://127.0.0.1:8791"
guiOperatorURL: "http://127.0.0.1:8792"
maxParallel: 4
defaultStepTimeout: 60s
policy:
  writeRequiresApproval: true
  allowAutoApprove: false
```

环境变量覆盖：`HELIOS_DATA_DIR`、`HELIOS_PI_URL` 等。

---

## 18. 垂直切片交付顺序（可执行）

### Slice A：无 AI 复现闭环

- schema、domain、demo CLIs、registry、clirunner、runtime(cli+approval)、fs store、API run/approve、curl 验收  
- **完成定义：** `workflows/demo.lead-sync.yaml` 跑通并留下 evidence

### Slice B：控制台最小

- validate/save/run/approve/evidence UI

### Slice C：Pi 编译

- sidecar compile + Go validate 回灌 + console Intent 框

### Slice D：ai 节点 + run_workflow skill

### Slice E：gui 升舱

详见 `docs/architecture/slice-e-gui.md`（契约、fake/playwright、验收）。

### Slice F：CLI factory 接入

详见 `docs/architecture/slice-f-cli-factory.md`（已实现：`helios-factory` + `demo-inventory`）。

---

## 19. 关键实现风险（细节层）

1. **JSON 插值进 argv 的转义：** 统一「对象 → 单参数 JSON 字符串」，测试含空格与引号。  
2. **并行写 scope：** 同层并行禁止写同一 `out`；调度前静态检查。  
3. **Pi 输出不稳：** 编译必须 Go validate 门禁；不要直接执行未校验 YAML。  
4. **审批并发：** 同一 run 单 flight；store 乐观版本号。  
5. **旧前端/旧类型：** 迁移时一次性切 API，避免双栈节点类型长期共存。

---

## 20. 下一步建议

1. 冻结 `contracts/workflow.schema.json` 与 `cli-introspect.schema.json`  
2. 实现 Slice A（可先不动 Pi）  
3. 选定真实平台后，把 demo CLI 换成真实 CLI，YAML 剧本改名保留结构  

开放问题 Q1（真实平台）不阻塞 Slice A。
