export type NodeType =
  | 'llm_task'
  | 'http_request'
  | 'form'
  | 'approval'
  | 'code'
  | 'human_task'
  | 'report'
  | 'dashboard';

export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type NodeStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface WorkflowTemplate {
  id: string;
  name: string;
  scenario: string;
  goal: string;
  summary: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  agentRoles: AgentRole[];
  appPages: AppPage[];
  createdAt: string;
}

export interface WorkflowNode {
  id: string;
  title: string;
  type: NodeType;
  agentRoleId: string;
  prompt: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  config?: Record<string, string>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface AgentRole {
  id: string;
  name: string;
  scope: string;
  permissions: string[];
}

export interface AppPage {
  id: string;
  nodeId: string;
  kind: string;
  title: string;
  fields?: AppField[];
  sections?: AppSection[];
  meta?: Record<string, string>;
}

export interface AppField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface AppSection {
  title: string;
  items: string[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  goal: string;
  status: RunStatus;
  nodeRuns: NodeRun[];
  evidence: Evidence[];
  artifacts: Artifact[];
  approvals: Approval[];
  adapters?: AdapterStatus[];
  startedAt: string;
  completedAt?: string;
}

export interface AdapterStatus {
  id: string;
  label: string;
  kind: string;
  available: boolean;
  reason?: string;
  command?: string;
  endpoint?: string;
  env?: string[];
  meta?: Record<string, string>;
}

export interface NodeRun {
  id: string;
  nodeId: string;
  title: string;
  type: NodeType;
  agentRoleId: string;
  status: NodeStatus;
  input: Record<string, string>;
  output: Record<string, string>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface Evidence {
  id: string;
  nodeId: string;
  claim: string;
  sources: string[];
  confidence: number;
}

export interface Artifact {
  id: string;
  nodeId: string;
  kind: string;
  title: string;
  content: string;
}

export interface Approval {
  id: string;
  nodeId: string;
  title: string;
  decision: string;
  reviewer: string;
  rationale: string;
}
