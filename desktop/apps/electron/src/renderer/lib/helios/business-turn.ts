import { compileIntent, healthCheck } from './client'
import { continueAfterApproval, runDemoFlow, runSavedWorkflow } from './demo-run'
import { extractRunParams } from './extract-params'
import type { PendingCompile } from './pending-compile'
import { resolveQuickWorkflow, summarizeWorkflowIntent } from './summarize'
import type { CardEvent } from './types'

const APPROVE_RE = /^(批准|同意|approve|yes|y|确认继续)$/i
const REJECT_RE = /^(拒绝|驳回|reject|no|n|停止)$/i
const CONFIRM_COMPILE_RE = /^(确认|开始|开始执行|继续|yes|y|ok)$/i
const CANCEL_COMPILE_RE = /^(取消|不要|算了|cancel)$/i

export type PendingApproval = {
  runId: string
  stepId: string
}

export type { PendingCompile }

export type BusinessTurnResult = {
  events: CardEvent[]
  pendingApproval: PendingApproval | null
  pendingCompile: PendingCompile | null
}

/** 业务对话一轮：审批续跑 / 编译确认 / 快捷演示 / 自由 compile。 */
export async function handleBusinessTurn(
  text: string,
  opts?: {
    pendingApproval?: PendingApproval | null
    pendingCompile?: PendingCompile | null
  },
): Promise<BusinessTurnResult> {
  const trimmed = text.trim()
  const pendingApproval = opts?.pendingApproval ?? null
  const pendingCompile = opts?.pendingCompile ?? null

  if (pendingApproval) {
    if (APPROVE_RE.test(trimmed) || trimmed.includes('批准')) {
      const events = await continueAfterApproval(
        pendingApproval.runId,
        pendingApproval.stepId,
        'approve',
      )
      return {
        events,
        pendingApproval: extractPending(events),
        pendingCompile: null,
      }
    }
    if (REJECT_RE.test(trimmed) || trimmed.includes('拒绝')) {
      const events = await continueAfterApproval(
        pendingApproval.runId,
        pendingApproval.stepId,
        'reject',
      )
      return { events, pendingApproval: null, pendingCompile: null }
    }
  }

  if (pendingCompile) {
    if (CONFIRM_COMPILE_RE.test(trimmed) || trimmed === '确认' || trimmed.includes('开始执行')) {
      try {
        const events = await runSavedWorkflow({
          workflowId: pendingCompile.workflowId,
          yaml: pendingCompile.yaml,
          params: pendingCompile.params,
        })
        return {
          events,
          pendingApproval: extractPending(events),
          pendingCompile: null,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          events: [
            {
              kind: 'text',
              text: `保存或启动失败：${message}。你可以改述需求再试，或回复「取消」。`,
            },
          ],
          pendingApproval: null,
          pendingCompile,
        }
      }
    }
    if (CANCEL_COMPILE_RE.test(trimmed) || trimmed.includes('取消')) {
      return {
        events: [{ kind: 'text', text: '好的，已取消这次工作流草稿。' }],
        pendingApproval: null,
        pendingCompile: null,
      }
    }
    return {
      events: [
        {
          kind: 'text',
          text: '还有一份待确认的工作流。请点「开始执行」，或回复「确认」/「取消」。',
        },
      ],
      pendingApproval: null,
      pendingCompile,
    }
  }

  if (!trimmed) {
    return {
      events: [
        {
          kind: 'text',
          text: '用自然语言告诉我你想做什么，例如「把线索 L-123 同步成采购单，写前要审批」。也可以说「帮我看看 Hacker News 热帖」跑演示。',
        },
      ],
      pendingApproval: null,
      pendingCompile: null,
    }
  }

  const quickId = resolveQuickWorkflow(trimmed)
  if (quickId) {
    const events = await runDemoFlow({ workflowId: quickId, autoConfirm: true })
    return {
      events,
      pendingApproval: extractPending(events),
      pendingCompile: null,
    }
  }

  const healthy = await healthCheck()
  if (!healthy) {
    return {
      events: [
        {
          kind: 'text',
          text: 'Helios 引擎还没起来。请先运行 ./scripts/dev-api.sh，并启动 Pi sidecar（./scripts/dev-pi-sidecar.sh）。',
        },
      ],
      pendingApproval: null,
      pendingCompile: null,
    }
  }

  try {
    const compiled = await compileIntent(trimmed)
    if (!compiled.validation.ok || !compiled.workflow?.id || !compiled.yaml) {
      const errs =
        compiled.validation.errors?.join('；') || '校验未通过，请换种说法再试。'
      return {
        events: [
          {
            kind: 'text',
            text: `还没法根据这句话生成可运行的工作流：${errs}`,
          },
        ],
        pendingApproval: null,
        pendingCompile: null,
      }
    }

    const summary = summarizeWorkflowIntent(compiled.workflow)
    const { params, usedDefaults } = extractRunParams(trimmed, compiled.workflow)
    const nextPending: PendingCompile = {
      yaml: compiled.yaml,
      workflowId: compiled.workflow.id,
      params,
      summary,
      intent: trimmed,
      usedDefaultParams: usedDefaults.length ? usedDefaults : undefined,
    }

    const paramHint =
      usedDefaults.length > 0
        ? `（未从话里读到 ${usedDefaults.join('、')}，演示将使用默认值 ${String(params.lead_id ?? '')}）`
        : Object.keys(params).length > 0
          ? `（参数：${Object.entries(params)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join('，')}）`
          : ''

    return {
      events: [
        { kind: 'text', text: '我根据你的描述草拟了一条工作流，请确认后开始执行：' },
        {
          kind: 'tool',
          toolName: 'confirm_intent',
          input: {
            summary: `${summary}${paramHint}`,
            workflowId: compiled.workflow.id,
            ...(Object.keys(params).length ? { params } : {}),
            awaitConfirm: true,
          },
        },
        {
          kind: 'text',
          text: '确认无误请点「开始执行」，或回复「确认」；不想跑就回复「取消」。',
        },
      ],
      pendingApproval: null,
      pendingCompile: nextPending,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      events: [
        {
          kind: 'text',
          text: `暂时没法编译这句话（${message}）。请确认 Pi sidecar 已启动，或换种说法再试。`,
        },
      ],
      pendingApproval: null,
      pendingCompile: null,
    }
  }
}

function extractPending(events: CardEvent[]): PendingApproval | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i]
    if (ev?.kind === 'tool' && ev.toolName === 'request_approval') {
      const runId = String(ev.input.runId ?? '')
      const stepId = String(ev.input.stepId ?? '')
      if (runId && stepId) return { runId, stepId }
    }
  }
  return null
}

export const HELIOS_CARDS_FENCE = 'helios-cards'

export function encodeHeliosMessage(events: CardEvent[]): string {
  const texts = events
    .filter((e): e is Extract<CardEvent, { kind: 'text' }> => e.kind === 'text')
    .map((e) => e.text)
  const tools = events.filter((e) => e.kind === 'tool')
  const intro = texts.join('\n\n')
  const fence = `\`\`\`${HELIOS_CARDS_FENCE}\n${JSON.stringify(tools)}\n\`\`\``
  return intro ? `${intro}\n\n${fence}` : fence
}

export function parseHeliosCards(content: string): CardEvent[] | null {
  const re = new RegExp(`\`\`\`${HELIOS_CARDS_FENCE}\\n([\\s\\S]*?)\\n\`\`\``)
  const m = content.match(re)
  if (!m?.[1]) return null
  try {
    const parsed = JSON.parse(m[1]) as CardEvent[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function stripHeliosFence(content: string): string {
  return content
    .replace(new RegExp(`\`\`\`${HELIOS_CARDS_FENCE}\\n[\\s\\S]*?\\n\`\`\``, 'g'), '')
    .trim()
}
