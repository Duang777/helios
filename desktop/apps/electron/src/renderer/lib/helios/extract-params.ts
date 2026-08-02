import type { Workflow } from './types'

const DEMO_DEFAULTS: Record<string, string> = {
  lead_id: 'L-123',
}

/** 从自然语言里抽 lead_id。 */
export function extractLeadId(intent: string): string | null {
  const m1 = intent.match(/\b(L-\d+)\b/i)
  if (m1?.[1]) return m1[1]
  const m2 = intent.match(/线索\s*[：:.]?\s*([A-Za-z0-9][\w-]*)/i)
  if (m2?.[1]) return m2[1]
  return null
}

/**
 * 按 workflow.params 填运行参数。
 * 必填缺失时用演示默认值（如 lead_id → L-123），并记入 usedDefaults。
 */
export function extractRunParams(
  intent: string,
  workflow?: Workflow | null,
): { params: Record<string, unknown>; usedDefaults: string[] } {
  const params: Record<string, unknown> = {}
  const usedDefaults: string[] = []
  const schema = workflow?.params ?? {}
  const wantsLead =
    'lead_id' in schema || workflow?.id === 'demo.lead-sync'

  if (!wantsLead) {
    return { params, usedDefaults }
  }

  const leadId = extractLeadId(intent)
  if (leadId) {
    params.lead_id = leadId
    return { params, usedDefaults }
  }

  const required =
    schema.lead_id?.required === true || workflow?.id === 'demo.lead-sync'
  if (required) {
    params.lead_id = DEMO_DEFAULTS.lead_id
    usedDefaults.push('lead_id')
  }
  return { params, usedDefaults }
}
