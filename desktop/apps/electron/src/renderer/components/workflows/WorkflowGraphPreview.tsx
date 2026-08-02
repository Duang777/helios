import * as React from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import type { CompileResult, WorkflowRun } from '@/lib/helios/types'
import {
  buildWorkflowGraphModel,
  type WorkflowGraphModel,
  type WorkflowGraphNode,
  type WorkflowGraphNodeKind,
  type WorkflowGraphStatus,
} from './workflow-graph-model'

const nodeTypes = {
  workflowNode: WorkflowGraphNodeView,
}

const STATUS_LABELS: Record<WorkflowGraphStatus, string> = {
  idle: '待处理',
  pending: '待处理',
  running: '运行中',
  completed: '完成',
  failed: '失败',
  waiting_approval: '待审批',
  waiting_human: '待人工',
  skipped: '跳过',
}

const KIND_LABELS: Record<WorkflowGraphNodeKind, string> = {
  start: '开始',
  end: '结束',
  step: '步骤',
  approval: '审批',
}

const STATUS_STYLES: Record<WorkflowGraphStatus, string> = {
  idle: 'border-border bg-background text-foreground',
  pending: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100',
  running: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100',
  completed: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100',
  failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100',
  waiting_approval: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100',
  waiting_human: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-100',
  skipped: 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100',
}

const KIND_STYLES: Record<WorkflowGraphNodeKind, string> = {
  start: 'shadow-[inset_0_0_0_1px_rgba(34,197,94,0.18)]',
  end: 'shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]',
  step: '',
  approval: 'shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22)]',
}

const NODE_BASE =
  'relative flex min-h-[88px] w-full flex-col rounded-md border px-3 py-2 text-left text-xs shadow-sm'

export interface WorkflowGraphPreviewProps {
  result: CompileResult | null
  run: WorkflowRun | null
}

export function WorkflowGraphPreview({ result, run }: WorkflowGraphPreviewProps): React.ReactElement {
  const graph = React.useMemo<WorkflowGraphModel>(() => buildWorkflowGraphModel(result, run), [result, run])

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-border/60 bg-background/70">
        <div className="rounded-md border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
          暂无图
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-[320px] overflow-hidden rounded-md border border-border/60 bg-background/70">
      <ReactFlowCanvas graph={graph} />
    </div>
  )
}

function ReactFlowCanvas({ graph }: { graph: WorkflowGraphModel }): React.ReactElement {
  const [instance, setInstance] = React.useState<ReactFlowInstance<WorkflowGraphNode, Edge> | null>(null)

  React.useEffect(() => {
    if (!instance || graph.nodes.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      instance.fitView({ padding: 0.2, duration: 0 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [graph.edges.length, graph.nodes.length, instance])

  return (
    <ReactFlow<WorkflowGraphNode, Edge>
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      onInit={setInstance}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      deleteKeyCode={null}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: 0.35 }}
      minZoom={0.25}
      maxZoom={1.8}
      defaultEdgeOptions={{
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      }}
      proOptions={{ hideAttribution: true }}
      className="bg-background/70"
    >
      <Controls showInteractive={false} />
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
    </ReactFlow>
  )
}

function WorkflowGraphNodeView({ data }: NodeProps<WorkflowGraphNode>): React.ReactElement {
  const isStart = data.kind === 'start'
  const isEnd = data.kind === 'end'
  const statusLabel = STATUS_LABELS[data.status]
  const kindLabel = KIND_LABELS[data.kind]

  return (
    <div className={cn(NODE_BASE, STATUS_STYLES[data.status], KIND_STYLES[data.kind], isStart && 'min-h-[68px]', isEnd && 'min-h-[68px]')}>
      {!isEnd && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-background !bg-foreground"
        />
      )}
      {!isStart && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-background !bg-foreground"
        />
      )}

      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium leading-5">{data.title}</div>
          {data.subtitle && <div className="mt-0.5 truncate text-[11px] opacity-70">{data.subtitle}</div>}
        </div>
        <span className="shrink-0 rounded-sm border border-current/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          {statusLabel}
        </span>
      </div>

      {data.prompt && !isStart && !isEnd && (
        <div className="mt-2 truncate text-[11px] leading-4 opacity-75">{data.prompt}</div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1 pt-2 text-[10px] font-medium uppercase tracking-wide">
        <span className="rounded-sm border border-current/15 px-1.5 py-0.5">{kindLabel}</span>
        {data.stepId && <span className="rounded-sm border border-current/15 px-1.5 py-0.5 font-mono normal-case">{data.stepId}</span>}
        {typeof data.needsCount === 'number' && data.needsCount > 0 && (
          <span className="rounded-sm border border-current/15 px-1.5 py-0.5 normal-case">依赖 {data.needsCount}</span>
        )}
      </div>
    </div>
  )
}
