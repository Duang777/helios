import type { AdapterStatus, WorkflowRun, WorkflowTemplate } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api';

interface CompileResponse {
  workflow: WorkflowTemplate;
}

interface RunResponse {
  run: WorkflowRun;
}

interface AdaptersResponse {
  adapters: AdapterStatus[];
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function compileWorkflow(goal: string): Promise<WorkflowTemplate> {
  const response = await fetch(`${API_BASE}/workflows/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });
  const payload = await parseResponse<CompileResponse>(response);
  return payload.workflow;
}

export async function runWorkflow(workflowId: string): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE}/workflows/${workflowId}/runs`, { method: 'POST' });
  const payload = await parseRunResponse(response);
  return payload.run;
}

export async function listRuntimeAdapters(): Promise<AdapterStatus[]> {
  const response = await fetch(`${API_BASE}/runtime/adapters`);
  const payload = await parseResponse<AdaptersResponse>(response);
  return payload.adapters;
}

async function parseRunResponse(response: Response): Promise<RunResponse> {
  const payload = await parseJSON<RunResponse & ApiErrorResponse>(response);
  if (!payload) {
    throw new Error('Response body must be valid JSON');
  }
  if (!response.ok && !payload.run) {
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`);
  }
  return payload;
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
