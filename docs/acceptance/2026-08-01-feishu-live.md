# Feishu Live Acceptance — 2026-08-01

Status: Recorded  
Related: Slice M / Slice O / PRD Q1  
Gate: `docs/architecture/dev-gate.md`

## What was proven

端到端真人路径（**真实 IM 副作用**）：

1. `lark-cli` 用户已登录；补齐日历 scope `calendar:calendar.event:read`（device flow）  
2. Helios 跑 `feishu.chat-list` → COMPLETED  
3. Helios 跑 `feishu.daily-brief`：auth → agenda → dry-run → **WAITING_APPROVAL** → approve → send  
4. 飞书会话收到简报消息  

## Identifiers

| 项 | 值 |
|----|-----|
| Helios run | `run_33732979a23724a5` |
| Chat | `oc_1266df091dd104054e88b5ea2290a401`（飞书用户6911IY的组织） |
| Message id | `om_x100b69fa79eb84a4b122cc33e699fb7` |
| Send time | `2026-08-01 02:03:30`（本地） |
| API port（验收机） | `18090` |
| Data dir（验收机） | `.helios-dev/live-accept/helios-final` |

## Send evidence (stdout)

```json
{
  "ok": true,
  "identity": "user",
  "data": {
    "chat_id": "oc_1266df091dd104054e88b5ea2290a401",
    "create_time": "2026-08-01 02:03:30",
    "message_id": "om_x100b69fa79eb84a4b122cc33e699fb7"
  }
}
```

Message text included: `Helios 真人验收 … daily-brief 真副作用确认`.

## Reproduce (optional)

```bash
# after lark login + scopes
./scripts/register-lark.sh
HELIOS_FEISHU_CHAT_ID=oc_1266df091dd104054e88b5ea2290a401 \
  ./scripts/smoke-feishu-daily-brief.sh
# then approve in console / API — will send another real message
```

Do **not** re-run casually: each approve produces a real IM.

## Non-goals audit (Slice O)

Confirmed still out of MVP scope (PRD §2.2 / agent.md):

- Temporal-scale durability cluster  
- Multi-tenant public SaaS  
- Full MCP marketplace  
- Pixel clone of Eko / helios.ai  
- Rewrite Pi in Go  
- Drag-and-drop workflow editor as MVP  
- Bit-exact GUI/AI replay  

No Slice A–N commit expanded those into default product paths.
