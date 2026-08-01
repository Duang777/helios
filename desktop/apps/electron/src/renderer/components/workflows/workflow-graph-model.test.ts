import { describe, expect, test } from 'bun:test'
import type { CompileResult, Workflow, WorkflowRun } from '../../lib/helios/types'
import { buildWorkflowGraphModel } from './workflow-graph-model'

const workflow: Workflow = {
  id: 'intent.sync-lead-to-po',
  version: 1,
  params: {
    lead_id: { type: 'string', required: true },
  },
  steps: [
    { id: 'fetch_lead', uses: 'cli', cli: 'demo-crm' },
    { id: 'approve_write', uses: 'approval', prompt: '是否继续？' },
    { id: 'create_po', uses: 'cli', cli: 'demo-erp' },
  ],
}

const compileResult: CompileResult = {
  yaml: 'id: intent.sync-lead-to-po\n',
  validation: { ok: true, errors: [] },
  workflow,
  ir: {
    id: workflow.id,
    version: workflow.version,
    params: workflow.params ?? {},
    steps: [
      { id: 'fetch_lead', uses: 'cli' },
      { id: 'approve_write', uses: 'approval', needs: ['fetch_lead'], prompt: '是否继续？' },
      { id: 'create_po', uses: 'cli', needs: ['approve_write'] },
    ],
  },
}

const run: WorkflowRun = {
  id: 'run_123',
  workflowId: workflow.id,
  status: 'WAITING_APPROVAL',
  params: { lead_id: 'L-123' },
  approvals: [],
  stepRuns: [
    { stepId: 'fetch_lead', uses: 'cli', status: 'COMPLETED' },
    { stepId: 'approve_write', uses: 'approval', status: 'WAITING_APPROVAL' },
    { stepId: 'create_po', uses: 'cli', status: 'PENDING' },
  ],
}

describe('buildWorkflowGraphModel', () => {
  test('builds stable graph nodes and edges from workflow dependencies', () => {
    const graph = buildWorkflowGraphModel(compileResult, run)
    const ids = graph.nodes.map((node) => node.id)
    const edges = graph.edges.map((edge) => `${edge.source}->${edge.target}`)

    expect(ids).toContain('__start__')
    expect(ids).toContain('__end__')
    expect(ids).toContain('fetch_lead')
    expect(ids).toContain('approve_write')
    expect(ids).toContain('create_po')
    expect(edges).toContain('__start__->fetch_lead')
    expect(edges).toContain('fetch_lead->approve_write')
    expect(edges).toContain('approve_write->create_po')
    expect(edges).toContain('create_po->__end__')
  })

  test('marks approval and runtime states distinctly', () => {
    const graph = buildWorkflowGraphModel(compileResult, run)
    const approval = graph.nodes.find((node) => node.id === 'approve_write')
    const completed = graph.nodes.find((node) => node.id === 'fetch_lead')

    expect(approval?.data.kind).toBe('approval')
    expect(approval?.data.status).toBe('waiting_approval')
    expect(completed?.data.status).toBe('completed')
  })
})
