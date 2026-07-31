export type StepUses = 'cli' | 'gui' | 'ai' | 'approval' | 'code';
export type SideEffect = 'none' | 'read' | 'write';
export type RunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_HUMAN'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED';
export type StepStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_HUMAN'
  | 'SKIPPED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED';

export interface ParamSpec {
  type: string;
  required?: boolean;
  description?: string;
}

export interface WorkflowStep {
  id: string;
  uses: StepUses;
  needs?: string[];
  when?: string;
  out?: string;
  sideEffect?: SideEffect;
  cli?: string;
  argv?: string[];
  prompt?: string;
  action?: string;
  gui?: Record<string, unknown>;
  aiPrompt?: string;
  aiModel?: string;
  outputSchema?: Record<string, unknown>;
}

export interface Workflow {
  apiVersion: string;
  kind: string;
  id: string;
  version: number;
  description?: string;
  params: Record<string, ParamSpec>;
  requires?: {
    clis?: Array<{ name: string; version?: string }>;
  };
  autoApprove?: boolean;
  steps: WorkflowStep[];
}

export interface StepRun {
  stepId: string;
  uses: StepUses;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
  prompt?: string;
}

export interface Evidence {
  id: string;
  runId: string;
  stepId: string;
  type: string;
  startedAt: string;
  endedAt: string;
  status: StepStatus;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  exitCode?: number;
  stdoutRef?: string;
  stderrRef?: string;
  screenshotRef?: string;
  error?: string;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  stepId: string;
  prompt: string;
  decision?: string;
  actor?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: RunStatus;
  params: Record<string, unknown>;
  stepRuns: StepRun[];
  evidence: Evidence[];
  approvals: ApprovalRecord[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface RegisteredCLI {
  name: string;
  version: string;
  path: string;
}

export interface CompileResult {
  yaml: string;
  validation: {
    ok: boolean;
    errors: string[];
  };
  warnings?: string[];
  attempts?: Array<{
    yaml: string;
    rawTraceId?: string;
    error?: string;
  }>;
  workflow?: Workflow;
}

export interface Manifest {
  id: string;
  version: number;
  title: string;
  params: Record<string, ParamSpec>;
  sideEffectLevel: SideEffect;
  requiresApprovals: boolean;
  clis: string[];
}

