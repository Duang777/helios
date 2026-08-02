import {
  approveRun,
  getWorkflow,
  healthCheck,
  saveWorkflow,
  startRun,
  waitForRun,
} from './client'
import {
  statusLabel,
  stepTitle,
  summarizeStepRuns,
  summarizeWorkflowIntent,
} from './summarize'
import type { CardEvent, WorkflowRun } from './types'

export const DEMO_WORKFLOW_ID = 'opencli.demo-read'

/** 快捷剧本演示参数（与 smoke / console 约定一致） */
const DEMO_RUN_PARAMS: Record<string, Record<string, unknown>> = {
  'demo.lead-sync': { lead_id: 'L-123' },
}

/** 将终态/待审批 run 转成步骤卡 + 审批卡或结果卡。 */
export function emitRunCards(run: WorkflowRun): CardEvent[] {
  const events: CardEvent[] = []
  for (const step of summarizeStepRuns(run)) {
    events.push({
      kind: 'tool',
      toolName: 'show_step',
      input: {
        title: step.title,
        status: step.status,
        statusLabel: step.statusLabel,
        detail: step.detail,
      },
      output: { ok: step.status === 'COMPLETED' },
    })
  }

  if (run.status === 'WAITING_APPROVAL') {
    const pending = run.approvals.find((a) => !a.decision) ?? run.approvals[0]
    const step =
      run.stepRuns.find((s) => s.status === 'WAITING_APPROVAL') ??
      run.stepRuns[run.stepRuns.length - 1]
    events.push({
      kind: 'tool',
      toolName: 'request_approval',
      input: {
        prompt: pending?.prompt || step?.prompt || '是否继续？',
        runId: run.id,
        stepId: pending?.stepId || step?.stepId || 'approval',
      },
    })
    return events
  }

  events.push(resultEvent(run))
  return events
}

/** 保存编译产物并启动运行，返回进度卡片。 */
export async function runSavedWorkflow(opts: {
  workflowId: string
  yaml: string
  params?: Record<string, unknown>
}): Promise<CardEvent[]> {
  await saveWorkflow(opts.workflowId, opts.yaml)
  const events: CardEvent[] = [
    { kind: 'text', text: '已按你的确认保存工作流，开始执行。' },
  ]
  let run = await startRun(opts.workflowId, opts.params ?? {})
  run = await waitForRun(run.id)
  events.push(...emitRunCards(run))
  return events
}

export async function runDemoFlow(opts?: {
  workflowId?: string
  autoConfirm?: boolean
  params?: Record<string, unknown>
}): Promise<CardEvent[]> {
  const workflowId = opts?.workflowId ?? DEMO_WORKFLOW_ID
  const events: CardEvent[] = []

  const ok = await healthCheck()
  if (!ok) {
    events.push({
      kind: 'text',
      text: '还连不上 Helios 引擎。请先在本机启动 API（./scripts/dev-api.sh）。',
    })
    events.push({
      kind: 'tool',
      toolName: 'show_result',
      input: {
        ok: false,
        headline: '引擎未就绪',
        details: ['确认后端已在 8080 端口运行'],
      },
      output: { seen: true },
    })
    return events
  }

  const workflow = await getWorkflow(workflowId)
  if (!workflow?.id) {
    events.push({
      kind: 'text',
      text: `找不到剧本 ${workflowId}，请确认 API 已加载该工作流。`,
    })
    return events
  }
  const summary = summarizeWorkflowIntent(workflow)
  const params = {
    ...(DEMO_RUN_PARAMS[workflowId] ?? {}),
    ...(opts?.params ?? {}),
  }

  events.push({
    kind: 'text',
    text: '好的，我准备好一条现成剧本。请先确认目标。',
  })
  events.push({
    kind: 'tool',
    toolName: 'confirm_intent',
    input: {
      summary,
      workflowId,
      ...(Object.keys(params).length ? { params } : {}),
    },
    output: opts?.autoConfirm === false ? undefined : { confirmed: true },
  })

  if (opts?.autoConfirm === false) {
    return events
  }

  events.push({ kind: 'text', text: '开始执行，进度会一张张卡片告诉你。' })

  let run = await startRun(workflowId, params)
  run = await waitForRun(run.id)
  events.push(...emitRunCards(run))
  return events
}

export async function continueAfterApproval(
  runId: string,
  stepId: string,
  decision: 'approve' | 'reject',
): Promise<CardEvent[]> {
  const events: CardEvent[] = []
  let run = await approveRun(runId, stepId, decision)
  if (decision === 'reject') {
    events.push({
      kind: 'tool',
      toolName: 'show_result',
      input: {
        ok: false,
        headline: '已按你的选择停止',
        runId,
      },
      output: { seen: true },
    })
    return events
  }
  run = await waitForRun(runId)
  events.push(...emitRunCards(run))
  return events
}

function resultEvent(run: WorkflowRun): CardEvent {
  const details = summarizeStepRuns(run)
    .flatMap((s) => (s.detail ? s.detail.split('\n') : []))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)

  if (run.status === 'COMPLETED') {
    return {
      kind: 'tool',
      toolName: 'show_result',
      input: {
        ok: true,
        headline: '搞定了',
        details: details.length ? details : ['流程已完成'],
        runId: run.id,
      },
      output: { seen: true },
    }
  }

  return {
    kind: 'tool',
    toolName: 'show_result',
    input: {
      ok: false,
      headline: `未能完成（${statusLabel(run.status)}）`,
      details: [run.error || stepTitle({ id: 'error' }, 0)].filter(Boolean),
      runId: run.id,
    },
    output: { seen: true },
  }
}
