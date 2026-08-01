# Slice X — Workflow Graph Preview

Status: Proposed
Date: 2026-08-01
Parent: Task 4 in `tasks/todo.md` / Slice W
Reuse: `@xyflow/react` (MIT, official xyflow project)
Gate: `docs/architecture/dev-gate.md`

## Goal

在 Desktop Workflow Studio 里，把已编译的 Helios workflow 以稳定的只读图形方式展示出来：步骤、依赖、审批节点、成功/失败状态一眼可见，帮助用户在保存和运行前快速检查结构。

## Non-goals

- 图上直接编辑节点或连线
- YAML 语法编辑器
- workflow folder 导入/导出
- TS DSL authoring
- 运行时 timeline / evidence / approval action 按钮

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| `@xyflow/react` | MIT | 作为只读 graph preview 的主渲染库 |
| Helios compile IR / YAML | 本仓库 | 图数据唯一来源 |
| `WorkflowStudioView` | 本仓库 | 继续作为图预览容器，右侧加入 graph tab |

**选择理由：** xyflow 官方站点与 GitHub 仓库都明确标注为开源且 MIT 许可，适合桌面端商业/内部使用；它也提供成熟的 node/edge、layout、interaction 能力，能避免自研图编辑器。

**禁止：** 自己手搓 canvas graph；把图结构从 YAML 再解析一遍当唯一真相；在通用布局组件里塞 graph 专属逻辑。

## Architecture

```text
CompileResult.ir / workflow / validation
  -> workflow-graph model (pure helper)
  -> WorkflowGraphPreview
      - nodes: step / approval / start / end
      - edges: needs / approval gating
      - status styles: pending / running / completed / failed / waiting_approval
  -> @xyflow/react
```

Graph 只读，布局和样式由 preview 决定，不回写 YAML。

## Contracts

### Input model

输入以 `CompileResult` 为主：

- `result.workflow` 优先
- 没有 `workflow` 时回退 `result.ir`
- 节点数据只使用 `id`、`uses`、`needs`、`sideEffect`、`prompt`、`validation` 和 run status

### Graph rules

- 每个 workflow step 生成一个 node
- `approval` step 显示为审批节点
- `needs` 生成 directed edge
- 运行态颜色由 step / run status 驱动
- YAML 里没有 `needs` 时，不伪造边

## Implementation plan

| Step | Delivery | Proof |
|------|----------|-------|
| 1 | 纯函数把 `CompileResult` 转成 graph nodes/edges | `bun test` |
| 2 | 新增只读 `WorkflowGraphPreview` 组件 | `cd desktop && bun run typecheck` |
| 3 | Workflow Studio 右侧加入 `Graph` tab，并保留 YAML/Validation/IR/Run | `cd desktop && bun run build:renderer` |
| 4 | Browser/Electron 截图确认图不空、节点不重叠、状态可见 | 手工截图 |

## Code standards

- `desktop/apps/electron/src/renderer/components/workflows/WorkflowGraphPreview.tsx` 只负责渲染，不写解析逻辑。
- 图数据转换放在 `workflow-graph-model.ts` 这类纯函数里，便于单测。
- 节点文案保持短，避免图上长句溢出。
- 默认只读，不暴露拖拽、缩放以外的编辑动作。
- 任何新的状态色都必须有文本/图标辅助，不只靠颜色。

## Required skills

1. `frontend-ui-engineering`
2. `incremental-implementation`
3. `test-driven-development`
4. `documentation-and-adrs`
5. `browser-testing-with-devtools` or equivalent browser verification

## Security

- Graph 输入来自本机 Helios API，不执行任何代码。
- YAML / prompt 文本按不可信字符串展示。
- 不引入远程资源或外部 CDN。

## Acceptance

```bash
cd desktop && bun run typecheck
cd desktop && bun run build:renderer
```

Browser verification:

1. 打开 Workflow Studio
2. 编译一条有审批的 workflow
3. 切到 Graph tab
4. 确认 node / edge / status 可见，且无 console error

## Risks / rollback

- 图布局过密：先退回到只显示关键节点和 edges。
- xyflow API 学习成本过高：保持只读节点图，避免引入高级交互。
- 如果图渲染与现有 YAML 面板互相抢空间，回退到独立 tab，不做并排分屏。

## Follow-ups

- Task 5: workflow folder import/export
- Task 8: run timeline / approval actions / evidence panel
