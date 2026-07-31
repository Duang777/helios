# Slice O — MVP §15 Acceptance Closeout

Status: Implemented  
Date: 2026-08-01  
Parent: PRD §15 / Q1 closed (Slice M); live Feishu accept 2026-08-01  
Gate: `docs/architecture/dev-gate.md`

## Goal

把 PRD **§15 MVP 验收检查清单**从「能力已具备但未勾选」收到可复核状态：

1. 一条可复制的聚合验收命令映射清单各项  
2. 记录飞书真人验收（真 IM 副作用）证据指针  
3. 勾选 PRD §15；确认 §2.2「不做列表」未被扩大  
4. 刷新 `agent.md` / `tasks/*` / `dev-gate` 排队  

本切片以 **文档 + 验收脚本** 为主；不引入新 Runtime 能力。

## Non-goals

- 关闭 Q2–Q6（产品定稿问题，另议）  
- Console 视觉大改  
- 再发飞书消息（引用已完成的真人验收即可）  
- Temporal / 拖拽编辑器 / SKUFlow / SaaS  

## Reuse

| 对象 | 用法 |
|------|------|
| 既有 `scripts/smoke-*.sh` | 直接编排，不重写业务路径 |
| Slice M / I 文档 | 真人验收引用 |

## Architecture

```text
PRD §15 checklist
        │
        ▼
scripts/smoke-mvp-acceptance.sh
        ├── unit: go test / npm test（按子集）
        ├── smoke-compile.sh          → Intent→YAML + validate
        ├── smoke-lead-sync.sh        → registry + dry-run→approve→write + evidence + 顺序
        ├── smoke-lead-sync-ai.sh     → Pi AI + publish 路径（含 run 能力）
        └── 文档审计：§2.2 不做列表 vs agent Out-of-scope
        │
        ▼
docs/acceptance/2026-08-01-feishu-live.md  （真人指针）
docs/prd §15 勾选
```

## Contracts

无新 API / YAML 契约。验收脚本 exit 0 = 清单对应项绿。

### §15 ↔ 证明映射

| §15 项 | 证明 |
|--------|------|
| Intent → YAML 草稿可生成 | `./scripts/smoke-compile.sh` |
| YAML 校验信息明确 | 同上 + `go test ./internal/schema/` |
| CLI Registry allowlist | `./scripts/smoke-lead-sync.sh` |
| dry-run → approval → write | `./scripts/smoke-lead-sync.sh` |
| Run 证据可查看 | lead-sync evidence on disk；Slice K API 已落地 |
| 同制品同参 cli 顺序稳定 | `smoke-lead-sync` 二次跑（脚本内断言） |
| `run_workflow` API 可用 | `smoke-lead-sync-ai.sh` 含 publish；或脚本内嵌 run_workflow |
| Pi 能触发已发布 workflow | `smoke-lead-sync-ai.sh`（ai 节点 + 运行时） |
| 文档对齐 | 本切片回写 PRD / agent / feishu-cli |
| 不做列表未扩大 | `docs/acceptance/...` 审计段 + agent Out-of-scope |

### 真人验收（已发生，不重跑）

- Run: `run_33732979a23724a5`  
- Chat: `oc_1266df091dd104054e88b5ea2290a401`  
- Message: `om_x100b69fa79eb84a4b122cc33e699fb7`  
- 详情：`docs/acceptance/2026-08-01-feishu-live.md`

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| O1 | 本文 Accepted | — |
| O2 | `scripts/smoke-mvp-acceptance.sh` | 脚本可跑 |
| O3 | 飞书真人验收 md | 文件存在 |
| O4 | 跑聚合 smoke（本地） | exit 0 |
| O5 | PRD §15 勾选；agent/todo/dev-gate | 文档 diff |
| O6 | 提交推送 | PR 或 push |

## Code standards

- 聚合脚本：`set -euo pipefail`；失败打印失败子命令名  
- 不改业务包路径  
- **Never：** 为勾选清单放宽 allowlist / 跳过 approval  

## Required skills

1. `documentation-and-adrs`  
2. `incremental-implementation`  
3. `git-workflow-and-versioning`（用户要求提交时）  

## Acceptance

```bash
./scripts/smoke-mvp-acceptance.sh
# 文档存在：
test -f docs/acceptance/2026-08-01-feishu-live.md
test -f docs/architecture/slice-o-mvp-acceptance.md
# PRD §15 全部 [x]
```

## Risks / rollback

聚合 smoke 过长：默认跑核心子集；可选 `HELIOS_MVP_FULL=1` 加 GUI/Feishu mock。回滚仅删文档与脚本，无运行时风险。

## Follow-ups

- Q2–Q6 决策会  
- Console 工具台打磨  
- CI 挂 `smoke-mvp-acceptance.sh`  
