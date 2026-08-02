export type RunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_HUMAN'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'

export type StepStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_HUMAN'
  | 'SKIPPED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'

export interface WorkflowStep {
  id: string
  uses: string
  prompt?: string
  cli?: string
  description?: string
}

export type ConnectorSideEffect = 'none' | 'read' | 'write'

export interface CLIArgSpec {
  name: string
  type: string
  required?: boolean
  enum?: string[]
  default?: unknown
}

export interface CLICommandSpec {
  path: string[]
  sideEffect: ConnectorSideEffect
  dryRun?: boolean
  args?: CLIArgSpec[]
}

export interface CLIIntrospect {
  name: string
  version: string
  commands: CLICommandSpec[]
}

export interface RegisteredCLI {
  name: string
  version: string
  path: string
  introspect: CLIIntrospect
}

export interface CommunityMcpRegistryServerSummary {
  name: string
  title?: string
  description?: string
  version?: string
  transport?: string
  installHint?: string
  repositoryUrl?: string
  websiteUrl?: string
  status?: string
  isLatest?: boolean
}

export interface CommunityMcpRegistryResponse {
  servers: CommunityMcpRegistryServerSummary[]
  metadata?: {
    nextCursor?: string
    count?: number
  }
}

export interface Workflow {
  id: string
  version: number
  description?: string
  steps: WorkflowStep[]
  params?: Record<string, { type: string; required?: boolean; description?: string }>
}

export interface CompileIRParam {
  type: string
  required?: boolean
  description?: string
}

export interface CompileIRStep {
  id: string
  uses: string
  needs?: string[]
  cli?: string
  sideEffect?: string
  prompt?: string
}

export interface CompileIR {
  id: string
  version: number
  description?: string
  params: Record<string, CompileIRParam>
  steps: CompileIRStep[]
}

export interface CompileAttempt {
  yaml: string
  mode?: string
  model?: string
  rawTraceId?: string
  error?: string
}

export interface StepRun {
  stepId: string
  uses: string
  status: StepStatus
  error?: string
  output?: Record<string, unknown>
  prompt?: string
}

export interface ApprovalRecord {
  id: string
  runId: string
  stepId: string
  prompt: string
  decision?: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: RunStatus
  stepRuns: StepRun[]
  approvals: ApprovalRecord[]
  error?: string
  params: Record<string, unknown>
}

export interface WorkflowValidation {
  ok: boolean
  errors: string[]
}

export interface WorkflowValidationResponse extends WorkflowValidation {
  workflow?: Workflow
}

export interface CompileResult {
  yaml: string
  mode?: string
  model?: string
  ir?: CompileIR
  validation: WorkflowValidation
  warnings?: string[]
  attempts?: CompileAttempt[]
  repairAttempts?: CompileAttempt[]
  workflow?: Workflow
}

export type CardEvent =
  | { kind: 'text'; text: string }
  | {
      kind: 'tool'
      toolName: 'confirm_intent' | 'show_step' | 'request_approval' | 'show_result'
      input: Record<string, unknown>
      output?: Record<string, unknown>
    }
