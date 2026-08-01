import { extractRunParams } from '../../lib/helios/extract-params'
import type { CompileAttempt, CompileResult, Workflow, WorkflowValidationResponse } from '../../lib/helios/types'

export function getWorkflowDraftId(result: CompileResult | null | undefined): string | null {
  return result?.workflow?.id ?? result?.ir?.id ?? null
}

export function canSaveDraft(result: CompileResult | null | undefined, yaml: string): boolean {
  return result?.validation.ok === true && yaml.trim().length > 0 && getWorkflowDraftId(result) != null
}

export function getCompileAttempts(result: CompileResult | null | undefined): CompileAttempt[] {
  return result?.repairAttempts?.length ? result.repairAttempts : result?.attempts ?? []
}

export function buildFolderImportResult(
  yaml: string,
  validation: WorkflowValidationResponse,
  folderName?: string | null,
): CompileResult {
  const errors = [...validation.errors]
  if (validation.workflow?.id && folderName && validation.workflow.id !== folderName) {
    errors.push(`workflow id ${validation.workflow.id} must match folder name ${folderName}`)
  }
  return {
    yaml,
    mode: 'folder-import',
    validation: {
      ok: validation.ok && errors.length === 0,
      errors,
    },
    workflow: validation.workflow,
    warnings: [],
  }
}

export function buildStudioRunParams(
  intent: string,
  workflow: Workflow | null | undefined,
): { params: Record<string, unknown>; usedDefaults: string[] } {
  return extractRunParams(intent, workflow)
}
