# Slice I — Feishu / Lark CLI Thickening

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/feishu-cli.md`, PRD platform CLI path  
Reuse: official `lark-cli` (`@larksuite/cli`) via existing `helios-lark` wrapper  
Gate: `docs/architecture/dev-gate.md`

## Goal

把飞书接入从「能发消息」加厚到「日历 / 云文档 / 任务 / 表格」可读可演示，且写路径仍审批闸门：

1. 扩展 `helios-lark` introspect allowlist（官方 `+shortcut` 优先）  
2. 新增只读 + 一条审批写工作流  
3. 无凭证时可跑 doctor / introspect smoke；有凭证时可跑 agenda / chat-list 等  
4. 文档与注册脚本同步  

## Non-goals

- 开放 `lark-cli api` 任意路径为默认（保留 allowlist 中的 `api` 逃生口，但不新建裸 API 工作流）  
- 自动 `config init` / 托管租户密钥  
- Base / Mail / VC 全量域（Follow-up）  
- 改 Runtime 契约或审批语义  

## Reuse

| 对象 | 用法 |
|------|------|
| `@larksuite/cli` / `lark-cli` | 直接转发；本机凭证 |
| `helios-lark` | 只扩 introspect；不复刻官方语义 |
| 现有 `uses: cli` + `approval` | 写步骤沿用 |

## Architecture

```text
Workflow YAML
    │ argv: [domain, +shortcut, flags...]
    ▼
Runtime clirunner → registry.Allowlisted(introspect)
    ▼
helios-lark proxy → lark-cli
    ▼
evidence stdout/stderr (官方 JSON / hint)
```

## Contracts

### helios-lark introspect（v0.2.0）

新增只读 path：

| Path | Risk |
|------|------|
| `calendar +agenda` | read（已有） |
| `calendar +freebusy` | read |
| `calendar +search-event` | read |
| `im +chat-list` | read（已有） |
| `docs +search` | read |
| `docs +fetch` | read |
| `task +get-my-tasks` | read |
| `task +search` | read |
| `sheets +cells-get` | read |
| `sheets +csv-get` | read |

新增写 path（DryRun 支持处标 `dryRun: true`）：

| Path | Risk |
|------|------|
| `calendar +create` | write |
| `docs +create` | write |
| `im +messages-send` | write（已有） |

保留：`doctor`、`auth status|login`、`api`、`introspect`。

### Workflows

| ID | 步骤要点 |
|----|----------|
| `feishu.calendar-agenda` | `calendar +agenda` |
| `feishu.chat-list` | `im +chat-list` |
| `feishu.my-tasks` | `task +get-my-tasks` |
| `feishu.docs-search` | `docs +search --query` |
| `feishu.sheets-cells-get` | `sheets +cells-get`（token/url + range） |
| `feishu.calendar-create` | dry-run → approval → `calendar +create` |

既有 `feishu.doctor` / `auth-status` / `send-text` 不变。

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| I1 | 本文 Accepted | — |
| I2 | `main.go` allowlist + version `0.2.0` | `go build` + introspect JSON 含新 path |
| I3 | 新 YAML + `register-lark.sh` | schema 加载 |
| I4 | `docs/feishu-cli.md` + smoke | `smoke-feishu-lark.sh` 绿（无凭证） |
| I5 | Status → Implemented；提交 feature 分支 | git |

## Code standards

- 只改 `backend/cmd/helios-lark`、`workflows/feishu.*`、`scripts/*lark*`、`docs/feishu-cli.md`、本设计、`agent.md`  
- allowlist 用官方 `+shortcut` 字面量；禁止把 high-risk-write 默认进工作流  
- 凭证仍只在本机 `lark-cli`；YAML 不写 secret  
- 写工作流必须有 `approval` 步  

## Required skills

- `documentation-and-adrs`（本设计）  
- `incremental-implementation`  
- `test-driven-development`（smoke + schema）  
- `git-workflow-and-versioning`（单切片提交）  

## Acceptance

```bash
cd backend && go build -o /tmp/helios-lark ./cmd/helios-lark
/tmp/helios-lark introspect | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["version"]=="0.2.0"; paths=[" ".join(c["path"]) for c in d["commands"]]; assert "docs +search" in paths and "calendar +create" in paths'
cd backend && go test ./internal/schema/ ./internal/registry/
./scripts/smoke-feishu-lark.sh
```

有凭证时手工：`feishu.calendar-agenda`、`feishu.chat-list` 应 COMPLETED。

## Risks / Rollback

| 风险 | 缓解 |
|------|------|
| 官方 shortcut 改名 | pin 文档写「以本机 `lark-cli --help` 为准」；版本 bump wrapper |
| 无凭证 CI 失败 | smoke 只测 doctor 失败形态或 introspect/register；不要求 login |
| allowlist 过宽 | 本切片不扩 base/mail；`api` 保持逃生口但不演示 |

回滚：revert 本切片提交；旧工作流仍可用 `0.1.0` allowlist 子集。
