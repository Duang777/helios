import { describe, expect, test } from 'bun:test'
import type { CompileResult, Workflow } from '../../lib/helios/types'
import {
  buildFolderImportResult,
  buildStudioRunParams,
  canSaveDraft,
  getCompileAttempts,
  getWorkflowDraftId,
} from './workflow-studio-helpers'

const leadWorkflow: Workflow = {
  id: 'demo.lead-sync',
  version: 1,
  description: '同步线索',
  params: {
    lead_id: { type: 'string', required: true },
  },
  steps: [
    { id: 'read', uses: 'cli.run', cli: 'lead get' },
  ],
}

function compileResult(overrides: Partial<CompileResult>): CompileResult {
  return {
    yaml: 'id: demo.lead-sync\nversion: 1\n',
    validation: { ok: true, errors: [] },
    workflow: leadWorkflow,
    ...overrides,
  }
}

describe('workflow studio helpers', () => {
  test('allows saving only validated drafts with yaml and a workflow id', () => {
    expect(canSaveDraft(compileResult({}), 'id: demo.lead-sync\n')).toBe(true)
    expect(canSaveDraft(compileResult({ validation: { ok: false, errors: ['bad'] } }), 'id: demo.lead-sync\n')).toBe(false)
    expect(canSaveDraft(compileResult({ workflow: undefined, ir: undefined }), 'id: demo.lead-sync\n')).toBe(false)
    expect(canSaveDraft(compileResult({}), '   ')).toBe(false)
  })

  test('uses workflow id first and IR id as fallback', () => {
    expect(getWorkflowDraftId(compileResult({}))).toBe('demo.lead-sync')
    expect(getWorkflowDraftId(compileResult({ workflow: undefined, ir: { id: 'ir.workflow', version: 1, params: {}, steps: [] } }))).toBe('ir.workflow')
    expect(getWorkflowDraftId(null)).toBeNull()
  })

  test('normalizes repair attempts and legacy attempts', () => {
    const repaired = getCompileAttempts(compileResult({
      repairAttempts: [{ yaml: 'repair', error: 'validation failed' }],
      attempts: [{ yaml: 'legacy' }],
    }))
    const legacy = getCompileAttempts(compileResult({
      repairAttempts: undefined,
      attempts: [{ yaml: 'legacy' }],
    }))

    expect(repaired).toEqual([{ yaml: 'repair', error: 'validation failed' }])
    expect(legacy).toEqual([{ yaml: 'legacy' }])
  })

  test('builds run params from the validated workflow schema', () => {
    expect(buildStudioRunParams('同步线索 L-456', leadWorkflow)).toEqual({
      params: { lead_id: 'L-456' },
      usedDefaults: [],
    })
    expect(buildStudioRunParams('同步线索', leadWorkflow)).toEqual({
      params: { lead_id: 'L-123' },
      usedDefaults: ['lead_id'],
    })
  })

  test('builds folder import results and flags id mismatches', () => {
    expect(buildFolderImportResult('id: demo.folder-smoke\n', {
      ok: true,
      errors: [],
      workflow: { ...leadWorkflow, id: 'demo.folder-smoke' },
    }, 'demo.folder-smoke')).toMatchObject({
      yaml: 'id: demo.folder-smoke\n',
      mode: 'folder-import',
      validation: { ok: true, errors: [] },
      workflow: { ...leadWorkflow, id: 'demo.folder-smoke' },
    })

    expect(buildFolderImportResult('id: demo.other\n', {
      ok: true,
      errors: [],
      workflow: leadWorkflow,
    }, 'wrong-name')).toMatchObject({
      validation: {
        ok: false,
        errors: ['workflow id demo.lead-sync must match folder name wrong-name'],
      },
    })
  })
})
