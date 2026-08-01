# Slice V — Desktop NL compile loop

Status: Implemented
Date: 2026-08-01
Accepted-by: user（对话确认：桌面优先；先闭环 mock compile→确认→保存→运行；快捷词降级）
Parent: Slice T（desktop）+ Slice C/N（compile）+ Slice S Step 4
Gate: `docs/architecture/dev-gate.md`

## Goal

桌面业务对话打通真实路径：

**自然语言 → `POST /compile` → 意图确认 → `PUT` 保存 → `POST /runs` → 步骤/审批/结果卡**

不再把含「线索」的句子截胡成预置 `runDemoFlow`；仅 HN 类显式演示词保留快捷剧本。

## Non-goals

- Live LLM 默认（mock 可验收；Live 另开）
- `web-business` 同步闭环
- 多轮澄清 UI、YAML 展示、Manifest publish
- 改 Go 编译契约

## Flow

1. 自由句 → `compileIntent`
2. `validation.ok` → 会话态 `PendingCompile`（yaml / workflowId / params）
3. 用户点「开始执行」或回复「确认」→ `saveWorkflow` → `startRun` → `emitRunCards`
4. 待审批 → 现有批准/拒绝路径

参数：从 intent 抽 `lead_id`（`L-\d+`）；缺失且必填时演示默认 `L-123`。

## Proof

```bash
./scripts/smoke-desktop-nl-compile.sh
# + 手工：桌面发「把线索 L-123 同步成采购单，写前要审批」→ 确认 → 审批 → 批准
```

依赖：Helios API + Pi sidecar（`HELIOS_PI_MODE=mock` 即可）。

## Key files

- `desktop/apps/electron/src/renderer/lib/helios/business-turn.ts`
- `desktop/apps/electron/src/renderer/lib/helios/demo-run.ts`（`runSavedWorkflow` / `emitRunCards`）
- `desktop/apps/electron/src/renderer/lib/helios/pending-compile.ts`
- `desktop/apps/electron/src/renderer/lib/helios/extract-params.ts`
- `desktop/apps/electron/src/renderer/components/helios/HeliosCards.tsx`
