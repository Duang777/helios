# Slice P — OpenCLI Adapter (Website → Helios CLI)

Status: Proposed  
Date: 2026-08-01  
Parent: PRD §5.4 CLI / F-L*；接入梯子「无公开 API」档  
Reuse: [jackwener/OpenCLI](https://github.com/jackwener/opencli)（Apache-2.0，`@jackwener/opencli`）  
Gate: `docs/architecture/dev-gate.md`  
Related: ADR-003（YAML DAG + TS 工具链）；`helios-lark` 包装模式  

## Goal

给 **没有公开 API、只有网页** 的平台一条 CLI-first 路径：

1. 用 **OpenCLI** 把站点结晶为确定性命令（explore/synthesize/generate 或现成 adapter）  
2. Helios 侧提供 **`helios-opencli` wrapper**：`introspect` allowlist + 透传执行 + JSON 归一  
3. 一条可演示 workflow：读路径 +（可选）审批后写路径  
4. 文档写清：OpenCLI 在接入梯子中的位置（位于 factory 与裸 GUI 之间）  

成功标准：无 OpenAPI 的样板站能通过 Registry → dry-run/审批策略 → evidence 跑通；**不**把自由 Browser-Agent 设为 Runtime 默认。

## Non-goals

- Fork / 内嵌 OpenCLI 源码进 Helios 内核  
- 运行时每次用 LLM 点选页面（Stagehand 默认路径）  
- 一次接入 OpenCLI 全部内置站点（只做 allowlist 子集 + 一个样板）  
- 替换 Playwright `uses: gui`（GUI 仍是兜底/升舱）  
- 关闭 Q6 / 改审批语义  

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| `@jackwener/opencli` / `opencli` | Apache-2.0 | **直接用**二进制；本机 Chrome 会话 |
| `helios-lark` 模式 | — | **适配层**：introspect + proxy，不复刻站点语义 |
| 现有 `uses: cli` + `approval` + evidence | — | 不变 |

**禁止：** 把 OpenCLI 的 `browser` 即时 Agent 面挂成 Helios 默认 `uses`；默认只跑 **已结晶 adapter 命令**。

## Architecture

```text
Workflow YAML (uses: cli)
        │ argv: [site, command, flags...]
        ▼
Runtime clirunner → registry allowlist(introspect)
        ▼
helios-opencli
        │ introspect → Helios CLIIntrospect JSON
        │ else → exec opencli <args...>  (capture stdout)
        ▼
normalize stdout → { ok, data|error } envelope when possible
        ▼
evidence on disk
```

接入梯子（产品叙述）：

```text
官方 CLI → OpenAPI factory/Lathe → OpenCLI(web→CLI) → uses:gui → human_help
```

## Contracts

### `helios-opencli` CLI

| 项 | 约定 |
|----|------|
| Name | `helios-opencli` |
| Version | `0.1.0` |
| `introspect` | 固定 allowlist（见下）；未知 path 拒绝 |
| Proxy | `os/exec` → `opencli`；PATH 可配 `HELIOS_OPENCLI_BIN` |
| Envelope | 若 stdout 已是 JSON 对象则包进 `data`；否则 `data: { raw: "..." }`；exit≠0 → `ok:false` |
| dry-run | 写命令：若 upstream 无 `--dry-run`，wrapper **拒绝在无审批工作流中直写**（workflow 仍强制 approval）；MVP 可对写命令要求 workflow 必有 approval，wrapper 对 `--dry-run` 返回 exit 9 + 预览 argv |

### Allowlist（MVP 建议，可在实现时微调）

只读样板（优先选不需登录或易复现的内置命令，例如）：

| Path | SideEffect | 备注 |
|------|------------|------|
| `doctor`（若有）或 `list` | read | 健康/发现 |
| `<demo-site> <demo-cmd>` | read | 一条稳定公共站命令（实现时锁定具体 site/cmd） |

写样板（可选第二步）：

| Path | SideEffect | DryRun |
|------|------------|--------|
| TBD 低风险写命令 | write | 尽量；否则仅 approval 后执行 |

### Workflow

| ID | 步骤 |
|----|------|
| `opencli.demo-read` | `helios-opencli` 只读命令 → evidence |
| （可选）`opencli.demo-write` | dry-run/预览 → approval → write |

### Env

| Var | 含义 |
|-----|------|
| `HELIOS_OPENCLI_BIN` | `opencli` 可执行文件路径 |
| Chrome / OpenCLI bridge | 按上游文档；凭证不进 YAML |

## Implementation plan（增量）

| Step | 交付 | 证明 |
|------|------|------|
| P0 | 本文 Accepted | 人审 |
| P1 | 调研笔记：安装、`opencli list`、选中样板命令、许可摘录 | `docs/research/` 短文或本节附录 |
| P2 | `backend/cmd/helios-opencli` introspect + proxy + envelope | `go test` / 手工 `--help` |
| P3 | 注册脚本 + `workflows/opencli.demo-read.yaml` | schema validate |
| P4 | `scripts/smoke-opencli.sh`（无 Chrome 时 SKIP 清晰；有则 COMPLETED） | smoke |
| P5 | 更新 `docs/feishu-cli.md` 旁的平台指南、`best-fit-oss`、`agent.md` | 文档 |
| P6 | （可选）一条写路径 + approval | smoke |

每步可测；禁止一次吞全站 adapter。

## Code standards

- 包：`backend/cmd/helios-opencli`（与 `helios-lark` 同级）  
- 命名：registry name `helios-opencli`  
- 错误：上游非 0 → Helios step FAILED；截断策略同 `clirunner`  
- 证据：stdout/stderr 全文入 evidence（注意脱敏：不写 cookie）  
- **Never：** Runtime 直接调 OpenCLI Node API；Never 默认 `opencli browser` 自由会话进 DAG  

## Required skills（实现前 Read）

1. `documentation-and-adrs`  
2. `incremental-implementation`  
3. `test-driven-development`  
4. `api-and-interface-design`（introspect / envelope）  
5. `security-and-hardening`（浏览器会话、命令注入、allowlist）  
6. `source-driven-development`（对照 OpenCLI 官方 README/skills）  

## Security

- Allowlist only；禁止把用户 YAML 任意字符串拼进 shell  
- 不在制品/证据中持久化 Cookie；依赖本机 Chrome profile  
- 写操作必须审批；评估 CSRF/误操作面  
- 超时与输出截断沿用 clirunner  

## Acceptance

```bash
# after Accepted + impl:
cd backend && go test ./cmd/helios-opencli/...   # if tests added
./scripts/smoke-opencli.sh
# logged-in Chrome + opencli installed → COMPLETED + evidence
# missing opencli → explicit SKIP message, exit 0 for CI optional gate
```

文档：

- `docs/architecture/slice-p-opencli-adapter.md` Status → Implemented  
- `docs/research/2026-08-01-best-fit-oss.md` 增加 OpenCLI 行  

## Risks / rollback

| 风险 | 缓解 |
|------|------|
| 站点改版导致 adapter 碎 | 样板选稳定公共命令；碎了降舱 GUI |
| OpenCLI 重 / 本机依赖多 | smoke SKIP；不进默认 `dev-api` 强依赖 |
| 与 gui-operator 职责重叠 | 文档分界：结晶 CLI 走 OpenCLI；一次性/无 adapter 走 gui |
| 许可/商标 | Apache-2.0 OK；不宣称官方附属 |

回滚：删 wrapper + workflow + registry 项；不影响飞书/factory。

## Follow-ups（不阻塞）

- OpenCLI `generate` 半自动进 Helios factory 叙事（P2）  
- 真实业务站（内部系统）第一条剧本  
- 推送并合并尚未上网的 ADR-003  

## 待你确认（Accepted 前）

1. 样板站命令锁定哪条？（建议实现前用 `opencli list` 实测后填进本文）  
2. MVP 是否包含写路径，还是只读一条即可？  
3. 确认后将 Status 改为 **Accepted**（或回复「按该文档实现」）  
