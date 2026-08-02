import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import type {
  WorkflowFolderExportRequest,
  WorkflowFolderExportResult,
  WorkflowFolderImportPreview,
  WorkflowFolderManifest,
} from '../../types'

const WORKFLOW_YAML_FILE = 'workflow.yaml'
const INTENT_FILE = 'INTENT.md'
const PROMPT_FILE = 'prompt.md'
const README_FILE = 'README.md'
const MANIFEST_FILE = 'manifest.json'
const EXPORT_TOOL = 'helios-desktop-workflow-studio'
const MANIFEST_SCHEMA = 'helios/workflow-folder@1'

export function isValidWorkflowId(workflowId: string): boolean {
  const trimmed = workflowId.trim()
  return trimmed.length > 0 && !trimmed.includes('..') && !/[\\/]/.test(trimmed)
}

export function resolveWorkflowFolderRoot(rootPath: string): string {
  const normalized = resolve(rootPath.trim())
  return basename(normalized) === 'workflows' ? normalized : join(normalized, 'workflows')
}

export function buildWorkflowFolderManifest(input: {
  workflowId: string
  workflowVersion: number
  workflowDescription?: string
  exportedAt?: string
}): WorkflowFolderManifest {
  const exportedFiles = [WORKFLOW_YAML_FILE, INTENT_FILE, MANIFEST_FILE]
  return {
    schema: MANIFEST_SCHEMA,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    exportedBy: EXPORT_TOOL,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    workflowDescription: input.workflowDescription?.trim() || undefined,
    exportedFiles,
  }
}

function normalizeMarkdownText(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd()
}

export function buildIntentMarkdown(intentMarkdown: string): string {
  return normalizeMarkdownText(intentMarkdown)
}

function readJsonManifest(raw: string): WorkflowFolderManifest | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowFolderManifest>
    const workflowId = String(parsed.workflowId ?? '').trim()
    const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt.trim() : ''
    if (parsed?.schema !== MANIFEST_SCHEMA) return null
    if (!isValidWorkflowId(workflowId)) return null
    if (typeof parsed.workflowVersion !== 'number') return null
    if (exportedAt.length === 0) return null
    if (!Array.isArray(parsed.exportedFiles)) return null
    return {
      schema: MANIFEST_SCHEMA,
      exportedAt,
      exportedBy: typeof parsed.exportedBy === 'string' && parsed.exportedBy.trim().length > 0
        ? parsed.exportedBy as WorkflowFolderManifest['exportedBy']
        : EXPORT_TOOL,
      workflowId,
      workflowVersion: parsed.workflowVersion,
      workflowDescription: typeof parsed.workflowDescription === 'string' ? parsed.workflowDescription.trim() || undefined : undefined,
      exportedFiles: parsed.exportedFiles.filter((file): file is string => typeof file === 'string'),
    }
  } catch {
    return null
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

export async function readWorkflowFolder(folderPath: string): Promise<WorkflowFolderImportPreview> {
  const folder = resolve(folderPath.trim())
  const folderName = basename(folder)
  const workflowYamlPath = join(folder, WORKFLOW_YAML_FILE)
  const intentMdPath = join(folder, INTENT_FILE)
  const promptMdPath = join(folder, PROMPT_FILE)
  const readmePath = join(folder, README_FILE)
  const manifestPath = join(folder, MANIFEST_FILE)

  const workflowYaml = await readFile(workflowYamlPath, 'utf-8')
  const [intentMarkdown, promptMarkdown, readmeMarkdown, manifestRaw] = await Promise.all([
    readOptionalText(intentMdPath),
    readOptionalText(promptMdPath),
    readOptionalText(readmePath),
    readOptionalText(manifestPath),
  ])

  const manifest = manifestRaw ? readJsonManifest(manifestRaw) : null
  const manifestError = manifestRaw && !manifest ? '无法解析 manifest.json' : null

  return {
    folderPath: folder,
    folderName,
    workflowYamlPath,
    workflowYaml,
    intentMdPath,
    intentMarkdown,
    promptMdPath,
    promptMarkdown,
    readmePath,
    readmeMarkdown,
    manifestPath,
    manifest,
    manifestError,
  }
}

export async function exportWorkflowFolder(
  input: WorkflowFolderExportRequest,
): Promise<WorkflowFolderExportResult> {
  const rootPath = resolveWorkflowFolderRoot(input.rootPath)
  const workflowId = input.workflowId.trim()
  if (!isValidWorkflowId(workflowId)) {
    throw new Error('workflow id 不能为空且不能包含路径分隔符')
  }
  if (!Number.isFinite(input.workflowVersion)) {
    throw new Error('workflow version 必须是数字')
  }
  const folderPath = join(rootPath, workflowId)
  const workflowYamlPath = join(folderPath, WORKFLOW_YAML_FILE)
  const intentMdPath = join(folderPath, INTENT_FILE)
  const manifestPath = join(folderPath, MANIFEST_FILE)

  await mkdir(folderPath, { recursive: true })
  await writeFile(workflowYamlPath, input.workflowYaml, 'utf-8')
  await writeFile(intentMdPath, `${buildIntentMarkdown(input.intentMarkdown)}\n`, 'utf-8')

  const manifest = buildWorkflowFolderManifest({
    workflowId,
    workflowVersion: input.workflowVersion,
    workflowDescription: input.workflowDescription,
  })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  return {
    folderPath,
    folderName: workflowId,
    workflowYamlPath,
    intentMdPath,
    manifestPath,
    manifest,
  }
}
