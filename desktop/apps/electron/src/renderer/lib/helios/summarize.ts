import type { StepRun, Workflow, WorkflowRun } from './types'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '等待中',
  READY: '准备就绪',
  RUNNING: '进行中',
  WAITING_APPROVAL: '等你确认',
  WAITING_HUMAN: '需要你协助',
  SKIPPED: '已跳过',
  COMPLETED: '已完成',
  FAILED: '失败',
  ABORTED: '已中止',
}

const FRIENDLY_STEP: Record<string, string> = {
  hn_top: '读取 Hacker News 热帖',
  fetch_lead: '从 CRM 读取销售线索',
  create_po_dry: '在 ERP 预演采购单（不落库）',
  approve: '确认后再创建采购单',
  create_po: '在 ERP 正式创建采购单',
  sync: '同步销售线索',
  approve_send: '确认后再发送',
}

export function stepTitle(
  step: { id: string; uses?: string; prompt?: string; cli?: string },
  index: number,
): string {
  if (step.prompt?.trim()) return step.prompt.trim()
  const friendly = FRIENDLY_STEP[step.id]
  if (friendly) return friendly
  if (step.uses === 'approval') return '需要你确认后才会继续'
  if (step.cli === 'helios-opencli') return '从网页读取公开信息'
  if (step.cli) return '调用业务系统完成一步'
  if (step.uses === 'ai') return '让 AI 整理结果'
  if (step.uses === 'gui') return '打开页面协助完成'
  return `第 ${index + 1} 步`
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

const FRIENDLY_WORKFLOW: Record<string, string> = {
  'opencli.demo-read': '读取 Hacker News 当前热帖列表（只读，不会改任何数据）',
  'demo.lead-sync': '同步一条销售线索；发送前会停下来请你确认',
}

export function summarizeWorkflowIntent(workflow: Workflow): string {
  const known = FRIENDLY_WORKFLOW[workflow.id]
  if (known) return known
  const desc = workflow.description?.trim()
  if (desc && !/^Slice\s/i.test(desc) && !/YAML|step id|wrapper/i.test(desc)) {
    return desc
  }
  const n = workflow.steps?.length ?? 0
  return `将按你的目标执行一条工作流，大约 ${n} 步`
}

export function summarizeStepRuns(run: WorkflowRun): Array<{
  title: string
  status: string
  statusLabel: string
  detail?: string
}> {
  return (run.stepRuns ?? []).map((sr, i) => ({
    title: stepTitle({ id: sr.stepId, uses: sr.uses, prompt: sr.prompt }, i),
    status: sr.status,
    statusLabel: statusLabel(sr.status),
    detail: humanStepDetail(sr),
  }))
}

function titlesFromUnknownList(list: unknown[]): string[] {
  return list
    .slice(0, 5)
    .map((item) => {
      if (item && typeof item === 'object' && 'title' in item) {
        return String((item as { title: unknown }).title)
      }
      return null
    })
    .filter((t): t is string => !!t)
}

function humanStepDetail(sr: StepRun): string | undefined {
  if (sr.error) return sr.error
  const out = sr.output
  if (!out) return undefined
  if (typeof out.title === 'string') return out.title
  if (out.data && typeof out.data === 'object' && !Array.isArray(out.data)) {
    const d = out.data as Record<string, unknown>
    if (typeof d.title === 'string') {
      const bits = [d.title]
      if (d.id != null) bits.push(`编号 ${String(d.id)}`)
      if (d.amount != null) bits.push(`金额 ${String(d.amount)}`)
      if (typeof d.status === 'string') bits.push(d.status)
      return bits.join(' · ')
    }
  }
  if (Array.isArray(out.data)) {
    const titles = titlesFromUnknownList(out.data)
    if (titles.length) {
      return titles.map((t, i) => `${i + 1}. ${t}`).join('\n')
    }
  }
  if (Array.isArray(out.items)) {
    const titles = titlesFromUnknownList(out.items)
    if (titles.length) {
      return titles.map((t, i) => `${i + 1}. ${t}`).join('\n')
    }
  }
  if (typeof out.summary === 'string') return out.summary
  return undefined
}

/** 仅显式演示词走预置剧本；「线索」等自由句走 /compile。 */
export function resolveQuickWorkflow(text: string): string | null {
  const t = text.toLowerCase()
  if (
    t.includes('hn') ||
    t.includes('hacker news') ||
    t.includes('热帖') ||
    t.includes('opencli') ||
    t.includes('demo-read') ||
    t.includes('看看新闻')
  ) {
    return 'opencli.demo-read'
  }
  return null
}
