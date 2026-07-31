import type { CompileResult, Manifest, RegisteredCLI, Workflow, WorkflowRun } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api/v1';

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function validateWorkflowYAML(yaml: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflows/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/yaml' },
    body: yaml,
  });
  const payload = await parseResponse<{ workflow: Workflow }>(response);
  return payload.workflow;
}

export async function saveWorkflow(id: string, yaml: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflows/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/yaml' },
    body: yaml,
  });
  const payload = await parseResponse<{ workflow: Workflow }>(response);
  return payload.workflow;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const response = await fetch(`${API_BASE}/workflows`);
  const payload = await parseResponse<{ workflows: Workflow[] }>(response);
  return payload.workflows ?? [];
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflows/${encodeURIComponent(id)}`);
  const payload = await parseResponse<{ workflow: Workflow }>(response);
  return payload.workflow;
}

export async function getWorkflowYAML(id: string): Promise<string> {
  const response = await fetch(`${API_BASE}/workflows/${encodeURIComponent(id)}/yaml`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`);
  }
  return response.text();
}

export async function startRun(workflowId: string, params: Record<string, unknown>): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/workflows/${encodeURIComponent(workflowId)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
  });
  const payload = await parseResponse<{ run: WorkflowRun }>(response);
  return payload.run;
}

export async function getRun(runId: string): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}`);
  const payload = await parseResponse<{ run: WorkflowRun }>(response);
  return payload.run;
}

export async function approveRun(runId: string, stepId: string, decision: 'approve' | 'reject', actor = 'console'): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId, decision, actor }),
  });
  const payload = await parseResponse<{ run: WorkflowRun }>(response);
  return payload.run;
}

export async function resolveHumanHelp(
  runId: string,
  stepId: string,
  ok: boolean,
  note = '',
  actor = 'console',
): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/human-help`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId, ok, note, actor }),
  });
  const payload = await parseResponse<{ run: WorkflowRun }>(response);
  return payload.run;
}

export async function listCLIs(): Promise<RegisteredCLI[]> {
  const response = await fetch(`${API_BASE}/clis`);
  const payload = await parseResponse<{ clis: RegisteredCLI[] }>(response);
  return payload.clis ?? [];
}

export async function compileIntent(intent: string, hints?: Record<string, unknown>): Promise<CompileResult> {
  const response = await fetch(`${API_BASE}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, hints }),
  });
  const payload = await parseJSON<(CompileResult & ApiErrorResponse) | ApiErrorResponse>(response);
  if (!payload) {
    throw new Error('Response body must be valid JSON');
  }
  // 422 still carries yaml draft + validation errors
  if (!response.ok && response.status !== 422) {
    throw new Error(payload.error?.message ?? `Request failed with ${response.status}`);
  }
  if (!('yaml' in payload) || typeof payload.yaml !== 'string') {
    throw new Error(payload.error?.message ?? 'compile response missing yaml');
  }
  return payload as CompileResult;
}

export async function publishWorkflow(id: string): Promise<Manifest> {
  const response = await fetch(`${API_BASE}/workflows/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
  const payload = await parseResponse<{ manifest: Manifest }>(response);
  return payload.manifest;
}

export async function listManifests(): Promise<Manifest[]> {
  const response = await fetch(`${API_BASE}/manifests`);
  const payload = await parseResponse<{ manifests: Manifest[] }>(response);
  return payload.manifests ?? [];
}

export async function runWorkflow(id: string, params: Record<string, unknown>): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/run_workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, params }),
  });
  const payload = await parseResponse<{ run: WorkflowRun }>(response);
  return payload.run;
}

export async function getEvidence(runId: string): Promise<{ evidence: WorkflowRun['evidence']; runDir: string }> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/evidence`);
  return parseResponse(response);
}

/** Absolute URL for a file under a run directory (evidence PNG, stdout, …). */
export function runFileURL(runId: string, relativePath: string): string {
  const parts = relativePath.split(/[/\\]+/).filter(Boolean).map(encodeURIComponent);
  return `${API_BASE}/runs/${encodeURIComponent(runId)}/files/${parts.join('/')}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await parseJSON<T & ApiErrorResponse>(response);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`);
  }
  if (!payload) {
    throw new Error('Response body must be valid JSON');
  }
  return payload;
}

async function parseJSON<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (!response.ok) {
      return null;
    }
    throw new Error('Response body must be valid JSON');
  }
}
