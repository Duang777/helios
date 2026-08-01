# Slice Q — OpenCLI Session Read (Browser-Bound Site)

Status: Implemented  
Date: 2026-08-01  
Parent: Slice P / `docs/opencli.md`  
Reuse: OpenCLI bilibili adapter（Chrome Bridge 会话）  
Gate: `docs/architecture/dev-gate.md`

## Goal

在 Slice P（公共 `hackernews top`）之上，证明 **需浏览器会话** 的结晶 CLI 也能进 Helios：

1. 扩展 `helios-opencli` allowlist：`bilibili hot` / `bilibili whoami`（+ 可选 `bilibili login`）  
2. 工作流 `opencli.bilibili-hot`：只读热门 → evidence  
3. Smoke：无 Bridge 时 **SKIP 清晰**；有 Bridge 时 COMPLETED  

## Non-goals

- 开放全部 bilibili / 全站 OpenCLI  
- 写路径（评论/关注）进 MVP  
- 自动安装 Chrome Extension  
- 改 Runtime 契约  

## Decision

| 项 | 选择 |
|----|------|
| 样板站 | **bilibili**（国内常见、adapter 成熟） |
| 只读命令 | `bilibili hot`（热门列表） |
| 会话探针 | `bilibili whoami`（需登录；文档说明，不强制 smoke） |
| 写命令 | `bilibili login` 仅 allowlist 供人手动建会话，不进默认剧本 |

## Architecture

```text
Chrome + OpenCLI Bridge
        │
        ▼
opencli bilibili hot -f json
        │
        ▼
helios-opencli (envelope) → Registry → Workflow → evidence
```

## Contracts

### helios-opencli v0.2.0 allowlist 新增

| Path | SideEffect | Args |
|------|------------|------|
| `bilibili hot` | read | `--limit`, `-f` / `--format` |
| `bilibili whoami` | read | `-f` |
| `bilibili login` | write | `--timeout`（建会话；无默认 workflow） |

保留 P：`list` / `doctor` / `hackernews top`。仍拒绝 `browser *`。

### Workflow

| ID | 步骤 |
|----|------|
| `opencli.bilibili-hot` | `bilibili hot --limit 5 -f json` |

### Smoke

```bash
./scripts/smoke-opencli-session.sh
# no bridge → SKIP exit 0
# HELIOS_OPENCLI_REQUIRE_SESSION=1 + bridge → must COMPLETED
```

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| Q1 | 本文 | — |
| Q2 | wrapper v0.2.0 + tests | `go test ./cmd/helios-opencli/` |
| Q3 | workflow + register + docs | schema/register |
| Q4 | smoke-opencli-session.sh | SKIP or GREEN |
| Q5 | agent / opencli.md | 文档 |

## Required skills

- `incremental-implementation`  
- `test-driven-development`  
- `security-and-hardening`（会话不进 YAML）  
- `documentation-and-adrs`  

## Acceptance

```bash
cd backend && go test ./cmd/helios-opencli/
./scripts/smoke-opencli.sh              # P 回归
./scripts/smoke-opencli-session.sh      # Q：SKIP 或 COMPLETED
```

## Risks

Bridge 未装是常态 → smoke 默认 SKIP，不挡 CI。  
站点改版 → 降舱 GUI / 换 adapter。  
