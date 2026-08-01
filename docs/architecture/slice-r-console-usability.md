# Slice R — Console Usability Fix

Status: Accepted  
Date: 2026-08-01  
Parent: Slice B console；用户反馈「看不懂 / 乱七八糟」  
Gate: `docs/architecture/dev-gate.md`

## Goal

把控制台改成能试玩的工具台，不改 Runtime 契约：

1. 按 workflow `params` 渲染参数（无参剧本不显示 `lead_id`）  
2. 加载剧本时同步/清空 Intent，避免文案与 YAML 错位  
3. 步骤完成后 **内联展示 output**（列表标题优先），不只 keys + stdout 链接  
4. RUNNING/PENDING 给人话进度；编译失败解释要起 Pi  

## Non-goals

- 视觉大改版 / 营销落地页  
- 拖拽编辑器  
- 改 API 契约  

## Implementation

`web/src/App.tsx` + 少量 `app.css`。

## Acceptance

手工：加载 `opencli.demo-read` → 运行 → 右侧直接看到 HN 标题列表；无 `lead_id` 框；编译失败文案可读。
