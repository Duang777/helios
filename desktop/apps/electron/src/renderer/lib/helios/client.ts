import type { CompileResult, CommunityMcpRegistryResponse, RegisteredCLI, Workflow, WorkflowRun, WorkflowValidationResponse } from './types'

const DEFAULT_BASE = 'http://127.0.0.1:8080/api/v1'

export function heliosBase(): string {
  const fromEnv =
    (import.meta as ImportMeta & { env?: { VITE_HELIOS_API_BASE?: string } }).env
      ?.VITE_HELIOS_API_BASE
  return (fromEnv || DEFAULT_BASE).replace(/\/$/, '')
}

async function parseJSON<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | { error?: { message?: string } }
    | null
  if (!payload) {
    throw new Error(`Helios 响应不是 JSON（HTTP ${response.status}）`)
  }
  if (!response.ok && response.status !== 422) {
    throw new Error(
      (payload as { error?: { message?: string } }).error?.message ??
        `Helios 请求失败（HTTP ${response.status}）`,
    )
  }
  return payload as T
}

export type HeliosHealth = {
  status: string
  service: string
  scheduler?: string
}

export async function fetchHealth(): Promise<HeliosHealth | null> {
  try {
    const response = await fetch(`${heliosBase()}/health`, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as HeliosHealth
  } catch {
    return null
  }
}

export async function healthCheck(): Promise<boolean> {
  return (await fetchHealth()) != null
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const response = await fetch(
    `${heliosBase()}/workflows/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  )
  const payload = await parseJSON<{ workflow: Workflow }>(response)
  return payload.workflow
}

export async function listCLIs(): Promise<RegisteredCLI[]> {
  const response = await fetch(`${heliosBase()}/clis`, { cache: 'no-store' })
  const payload = await parseJSON<{ clis: RegisteredCLI[] }>(response)
  return payload?.clis ?? []
}

export async function listCommunityMcpServers(query = '', limit = 12): Promise<CommunityMcpRegistryResponse> {
  const params = new URLSearchParams()
  const trimmed = query.trim()
  if (trimmed) {
    params.set('search', trimmed)
  }
  params.set('limit', String(Math.max(1, Math.min(50, limit))))
  const response = await fetch(`${heliosBase()}/mcp-registry/servers?${params.toString()}`, { cache: 'no-store' })
  const payload = await parseJSON<CommunityMcpRegistryResponse>(response)
  return payload
}

function requireRun(
  payload: { run?: WorkflowRun; error?: { message?: string } },
  status: number,
  action: string,
): WorkflowRun {
  if (payload.run?.id) return payload.run
  throw new Error(
    payload.error?.message ?? `${action}失败（HTTP ${status}）`,
  )
}

export async function startRun(
  workflowId: string,
  params: Record<string, unknown> = {},
): Promise<WorkflowRun> {
  const response = await fetch(
    `${heliosBase()}/workflows/${encodeURIComponent(workflowId)}/runs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
    },
  )
  const payload = await parseJSON<{
    run?: WorkflowRun
    error?: { message?: string }
  }>(response)
  return requireRun(payload, response.status, '启动运行')
}

export async function getRun(runId: string): Promise<WorkflowRun> {
  const response = await fetch(
    `${heliosBase()}/runs/${encodeURIComponent(runId)}`,
    { cache: 'no-store' },
  )
  const payload = await parseJSON<{
    run?: WorkflowRun
    error?: { message?: string }
  }>(response)
  return requireRun(payload, response.status, '读取运行')
}

export async function approveRun(
  runId: string,
  stepId: string,
  decision: 'approve' | 'reject',
  actor = 'helios-desktop',
): Promise<WorkflowRun> {
  const response = await fetch(
    `${heliosBase()}/runs/${encodeURIComponent(runId)}/approval`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, decision, actor }),
    },
  )
  const payload = await parseJSON<{
    run?: WorkflowRun
    error?: { message?: string }
  }>(response)
  return requireRun(payload, response.status, '提交审批')
}

export async function compileIntent(
  intent: string,
  hints?: Record<string, unknown>,
): Promise<CompileResult> {
  const response = await fetch(`${heliosBase()}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, hints }),
  })
  return parseJSON<CompileResult>(response)
}

export async function validateWorkflowYaml(yaml: string): Promise<WorkflowValidationResponse> {
  const response = await fetch(`${heliosBase()}/workflows/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/yaml' },
    body: yaml,
  })
  const payload = await response.json().catch(() => null) as
    | { ok?: boolean; workflow?: Workflow; error?: { message?: string } }
    | null
  if (!payload) {
    throw new Error(`Helios 响应不是 JSON（HTTP ${response.status}）`)
  }
  if (response.ok) {
    if (!payload.workflow) {
      throw new Error('Helios 验证响应缺少 workflow')
    }
    return {
      ok: true,
      errors: [],
      workflow: payload.workflow,
    }
  }
  return {
    ok: false,
    errors: [payload.error?.message ?? `workflow 校验失败（HTTP ${response.status}）`],
  }
}

export async function saveWorkflow(id: string, yaml: string): Promise<Workflow> {
  const response = await fetch(
    `${heliosBase()}/workflows/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/yaml' },
      body: yaml,
    },
  )
  const payload = await parseJSON<{
    workflow?: Workflow
    error?: { message?: string }
  }>(response)
  if (!payload.workflow?.id) {
    throw new Error(
      payload.error?.message ?? `保存工作流失败（HTTP ${response.status}）`,
    )
  }
  return payload.workflow
}

export async function waitForRun(
  runId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<WorkflowRun> {
  const timeoutMs = opts.timeoutMs ?? 120_000
  const intervalMs = opts.intervalMs ?? 800
  const started = Date.now()
  for (;;) {
    const run = await getRun(runId)
    if (
      run.status === 'COMPLETED' ||
      run.status === 'FAILED' ||
      run.status === 'ABORTED' ||
      run.status === 'WAITING_APPROVAL' ||
      run.status === 'WAITING_HUMAN'
    ) {
      return run
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('等待运行结果超时，请稍后再看')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
