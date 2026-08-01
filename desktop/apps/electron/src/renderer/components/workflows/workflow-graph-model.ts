import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { CompileResult, StepStatus, WorkflowRun } from '../../lib/helios/types'

export type WorkflowGraphStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'waiting_human'
  | 'skipped'

export type WorkflowGraphNodeKind = 'start' | 'end' | 'step' | 'approval'

export interface WorkflowGraphNodeData extends Record<string, unknown> {
  kind: WorkflowGraphNodeKind
  status: WorkflowGraphStatus
  title: string
  stepId?: string
  subtitle?: string
  prompt?: string
  cli?: string
  sideEffect?: string
  needsCount?: number
}

export type WorkflowGraphNode = Node<WorkflowGraphNodeData, 'workflowNode'>

export interface WorkflowGraphModel {
  nodes: WorkflowGraphNode[]
  edges: Edge[]
}

interface GraphStepLike {
  id: string
  uses: string
  needs?: string[]
  cli?: string
  sideEffect?: string
  prompt?: string
  description?: string
}

const NODE_WIDTH = 240
const STEP_GAP_Y = 180
const LAYER_GAP_X = 280
const BASE_X = 220
const BASE_Y = 60

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function stepStatusFromRunStatus(status?: StepStatus): WorkflowGraphStatus {
  switch (status) {
    case 'RUNNING':
      return 'running'
    case 'COMPLETED':
      return 'completed'
    case 'FAILED':
    case 'ABORTED':
      return 'failed'
    case 'WAITING_APPROVAL':
      return 'waiting_approval'
    case 'WAITING_HUMAN':
      return 'waiting_human'
    case 'SKIPPED':
      return 'skipped'
    case 'READY':
    case 'PENDING':
    default:
      return 'pending'
  }
}

function buildStatusByStepId(run?: WorkflowRun | null): Map<string, WorkflowGraphStatus> {
  const byId = new Map<string, WorkflowGraphStatus>()
  for (const stepRun of run?.stepRuns ?? []) {
    byId.set(stepRun.stepId, stepStatusFromRunStatus(stepRun.status))
  }
  return byId
}

function getWorkflowSteps(result?: CompileResult | null): GraphStepLike[] {
  const irSteps = result?.ir?.steps ?? []
  if (irSteps.length > 0) return irSteps
  return result?.workflow?.steps ?? []
}

function calculateStepRanks(steps: GraphStepLike[]): Map<string, number> {
  const stepById = new Map(steps.map((step) => [step.id, step]))
  const memo = new Map<string, number>()

  const rankOf = (stepId: string, trail: Set<string> = new Set()): number => {
    const cached = memo.get(stepId)
    if (cached !== undefined) return cached
    const step = stepById.get(stepId)
    if (!step) return 0
    const needs = unique(step.needs ?? []).filter((need) => stepById.has(need))
    if (needs.length === 0) {
      memo.set(stepId, 0)
      return 0
    }
    if (trail.has(stepId)) {
      return 0
    }
    trail.add(stepId)
    let rank = 0
    for (const need of needs) {
      rank = Math.max(rank, rankOf(need, trail) + 1)
    }
    trail.delete(stepId)
    memo.set(stepId, rank)
    return rank
  }

  for (const step of steps) {
    rankOf(step.id)
  }
  return memo
}

function inferNodeStatus(step: GraphStepLike, runStatus: Map<string, WorkflowGraphStatus>): WorkflowGraphStatus {
  return runStatus.get(step.id) ?? 'idle'
}

function inferNodeKind(step: GraphStepLike): WorkflowGraphNodeKind {
  return step.uses === 'approval' ? 'approval' : 'step'
}

function nodeSubtitle(step: GraphStepLike): string {
  const bits = [step.cli, step.sideEffect, step.description].filter(Boolean)
  return bits[0] ?? step.uses
}

export function buildWorkflowGraphModel(
  result?: CompileResult | null,
  run?: WorkflowRun | null,
): WorkflowGraphModel {
  const steps = getWorkflowSteps(result)
  if (steps.length === 0) {
    return { nodes: [], edges: [] }
  }

  const statusByStepId = buildStatusByStepId(run)
  const rankByStepId = calculateStepRanks(steps)
  const grouped = new Map<number, GraphStepLike[]>()
  let maxRank = 0
  const stepById = new Map(steps.map((step) => [step.id, step]))

  for (const step of steps) {
    const rank = rankByStepId.get(step.id) ?? 0
    maxRank = Math.max(maxRank, rank)
    const bucket = grouped.get(rank) ?? []
    bucket.push(step)
    grouped.set(rank, bucket)
  }

  const nodes: WorkflowGraphNode[] = []
  const edges: Edge[] = []

  nodes.push({
    id: '__start__',
    type: 'workflowNode',
    position: { x: 0, y: BASE_Y + 60 },
    data: {
      kind: 'start',
      status: 'completed',
      title: '开始',
      subtitle: 'workflow entry',
    },
    style: { width: 140 },
    draggable: false,
  })

  for (const [rank, rankSteps] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    rankSteps.forEach((step, index) => {
      const status = inferNodeStatus(step, statusByStepId)
      nodes.push({
        id: step.id,
        type: 'workflowNode',
        position: {
          x: BASE_X + rank * LAYER_GAP_X,
          y: BASE_Y + index * STEP_GAP_Y,
        },
        data: {
          kind: inferNodeKind(step),
          status,
          title: step.id,
          stepId: step.id,
          subtitle: nodeSubtitle(step),
          prompt: step.prompt,
          cli: step.cli,
          sideEffect: step.sideEffect,
          needsCount: unique(step.needs ?? []).length,
        },
        style: { width: NODE_WIDTH },
        draggable: false,
      })
    })
  }

  nodes.push({
    id: '__end__',
    type: 'workflowNode',
    position: { x: BASE_X + (maxRank + 1) * LAYER_GAP_X, y: BASE_Y + 60 },
    data: {
      kind: 'end',
      status: 'completed',
      title: '结束',
      subtitle: 'workflow exit',
    },
    style: { width: 140 },
    draggable: false,
  })

  const rootSteps = steps.filter((step) => unique(step.needs ?? []).filter((need) => stepById.has(need)).length === 0)
  const leafSteps = steps.filter((step) => !steps.some((other) => unique(other.needs ?? []).includes(step.id)))

  for (const step of steps) {
    for (const need of unique(step.needs ?? [])) {
      if (!stepById.has(need)) continue
      edges.push({
        id: `${need}->${step.id}`,
        source: need,
        target: step.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      })
    }
  }

  for (const root of rootSteps) {
    edges.push({
      id: `__start__->${root.id}`,
      source: '__start__',
      target: root.id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    })
  }

  for (const leaf of leafSteps) {
    edges.push({
      id: `${leaf.id}->__end__`,
      source: leaf.id,
      target: '__end__',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    })
  }

  return { nodes, edges }
}
