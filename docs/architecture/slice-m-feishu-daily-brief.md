# Slice M — Feishu Daily Brief Playbook (Q1)

Status: Implemented  
Date: 2026-08-01  
Parent: PRD Q1 / §3.3, `docs/architecture/slice-i-feishu-thicken.md`  
Gate: `docs/architecture/dev-gate.md`

## Goal

关闭 PRD **Q1（第一条真实业务平台）**：选定 **飞书 / Lark** 为第一条真实平台，并交付一条可演示的端到端剧本：

**每日日程简报 → 人工审批 → 发到指定会话**

路径：`auth` → `calendar +agenda` → `approval` → `im +messages-send`（dry-run 预览已含在审批前）。

## Decision (Q1)

| 项 | 选择 |
|----|------|
| 平台 | 飞书（`lark-cli` via `helios-lark`） |
| 剧本 ID | `feishu.daily-brief` |
| 为何不是 CRM/ERP demo | demo 只验收结构；飞书是真实 CLI + 真实副作用 |

## Non-goals

- AI 自动总结日程（可 Follow-up：`uses: ai`）  
- 自动选 chat（需人传 `chat_id`；可用 `feishu.chat-list` 先查）  
- Base / 多维表格剧本  
- 改 Runtime 契约  

## Playbook

```text
params: chat_id, note?
        │
        ▼
auth status          (read)
        │
        ▼
calendar +agenda     (read)  → evidence
        │
        ▼
im +messages-send --dry-run  (read)
        │
        ▼
approval             「将今日日程简报发到 ${chat_id}」
        │
        ▼
im +messages-send    (write)
```

消息正文模板（制品内固定，可含 note）：

```
【Helios 每日日程简报】
${params.note}
（完整日程 JSON 见本 Run 的 agenda 证据）
```

人在审批前可看 agenda 证据与 dry-run 请求。

## Contracts

### Workflow `feishu.daily-brief`

| Param | Required | 说明 |
|-------|----------|------|
| `chat_id` | yes | 目标会话 |
| `note` | no | 简报附加说明 |

`requires.clis`: `helios-lark >=0.2.0`

### Docs / registry

- 更新 `docs/feishu-cli.md`、`register-lark.sh`  
- PRD §3.3 与开放问题 Q1 标记飞书为选定  
- `agent.md` 记录 Slice M  

### Smoke

`scripts/smoke-feishu-daily-brief.sh`：

- 无凭证：注册工作流 + 跑到 auth/agenda 失败或完成均可，**不得** allowlist 错误；结构加载绿  
- 有凭证且给 `HELIOS_FEISHU_CHAT_ID`：可跑到 `WAITING_APPROVAL`（本 smoke 在审批处停或 auto-reject 证明门控）

默认：导入 YAML + schema 校验 + 启动 run 直到非 PENDING（不强制 COMPLETED）。

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| M1 | 本文 + PRD Q1 关闭 | — |
| M2 | `feishu.daily-brief.yaml` + register/docs | schema test |
| M3 | smoke | 脚本绿 |
| M4 | commit | git |

## Required skills

- `documentation-and-adrs`  
- `incremental-implementation`  
- `test-driven-development`  

## Acceptance

```bash
cd backend && go test ./internal/schema/
./scripts/smoke-feishu-daily-brief.sh
```

## Risks / Rollback

发错群：强制 approval。无 chat_id 不能写。回滚删除本剧本即可。
