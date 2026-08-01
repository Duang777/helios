import * as React from 'react'
import { AlertCircle, CheckCircle2, FolderOpen, FolderOutput, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WorkflowFolderImportPreview } from '@/types/workflow-folder'
import type { CompileIR, CompileResult, WorkflowRun } from '@/lib/helios/types'
import { getCompileAttempts, getWorkflowDraftId } from './workflow-studio-helpers'
import { WorkflowGraphPreview } from './WorkflowGraphPreview'

export type StudioStatus = 'idle' | 'compiling' | 'ready' | 'saving' | 'saved' | 'running' | 'error'

export function statusLabel(status: StudioStatus): string {
  switch (status) {
    case 'compiling':
      return '编译中'
    case 'ready':
      return '待保存'
    case 'saving':
      return '保存中'
    case 'saved':
      return '已保存'
    case 'running':
      return '运行中'
    case 'error':
      return '需要处理'
    case 'idle':
    default:
      return '未编译'
  }
}

export function ValidationBadge({ result }: { result: CompileResult | null }): React.ReactElement {
  if (!result) return <Badge variant="outline">未校验</Badge>
  if (result.validation.ok) {
    return (
      <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
        <CheckCircle2 className="size-3" />
        Validation OK
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <AlertCircle className="size-3" />
      Validation Failed
    </Badge>
  )
}

export function WorkflowSummary({ result }: { result: CompileResult | null }): React.ReactElement {
  const workflow = result?.workflow
  const ir = result?.ir
  const id = getWorkflowDraftId(result)
  const steps = workflow?.steps ?? ir?.steps ?? []
  const params = workflow?.params ?? ir?.params ?? {}

  return (
    <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
      <SummaryCell label="Workflow" value={id ?? '-'} />
      <SummaryCell label="Steps" value={String(steps.length)} />
      <SummaryCell label="Params" value={String(Object.keys(params).length)} />
      <SummaryCell label="Mode" value={result?.mode ?? '-'} />
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/55 px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] text-foreground">{value}</div>
    </div>
  )
}

export function CodeBlock({ value, empty }: { value: string; empty: string }): React.ReactElement {
  return (
    <ScrollArea className="h-full min-h-[320px] rounded-md border border-border/60 bg-background/70">
      <pre className="min-h-full whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-relaxed text-foreground">
        {value.trim() ? value : empty}
      </pre>
    </ScrollArea>
  )
}

export function ValidationPanel({ result }: { result: CompileResult | null }): React.ReactElement {
  const errors = result?.validation.errors ?? []
  const warnings = result?.warnings ?? []
  const attempts = getCompileAttempts(result)

  return (
    <ScrollArea className="h-full min-h-[320px] rounded-md border border-border/60 bg-background/70">
      <div className="space-y-4 p-4 text-sm">
        {!result && <p className="text-muted-foreground">编译后会显示 schema 校验、warnings 和 repair attempts。</p>}
        {result && (
          <>
            <section>
              <h3 className="text-sm font-medium">校验结果</h3>
              {errors.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有 validation error。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {errors.map((error, index) => (
                    <li key={`${index}-${error}`} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
                      {error}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="text-sm font-medium">Warnings</h3>
              {warnings.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有 warning。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {warnings.map((warning, index) => (
                    <li key={`${index}-${warning}`} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-200">
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="text-sm font-medium">Repair attempts</h3>
              {attempts.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有 repair attempt。</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {attempts.map((attempt, index) => (
                    <div key={`${index}-${attempt.rawTraceId ?? attempt.error ?? attempt.yaml.length}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Attempt {index + 1}</span>
                        <span>{attempt.mode ?? attempt.model ?? 'compile'}</span>
                      </div>
                      {attempt.error && <p className="mt-2 text-xs text-destructive">{attempt.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

export function IRPanel({ ir }: { ir?: CompileIR }): React.ReactElement {
  return (
    <CodeBlock
      value={ir ? JSON.stringify(ir, null, 2) : ''}
      empty="编译后会显示 IR 摘要。"
    />
  )
}

export function GraphPanel({
  result,
  run,
}: {
  result: CompileResult | null
  run: WorkflowRun | null
}): React.ReactElement {
  return <WorkflowGraphPreview result={result} run={run} />
}

export function RunPanel({ run, usedDefaults }: { run: WorkflowRun | null; usedDefaults: string[] }): React.ReactElement {
  return (
    <ScrollArea className="h-full min-h-[320px] rounded-md border border-border/60 bg-background/70">
      <div className="space-y-4 p-4 text-sm">
        {!run && <p className="text-muted-foreground">保存并运行后会显示 run id、状态和步骤结果。</p>}
        {run && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SummaryCell label="Run" value={run.id} />
              <SummaryCell label="Status" value={run.status} />
              <SummaryCell label="Workflow" value={run.workflowId} />
            </div>
            {usedDefaults.length > 0 && (
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertCircle className="size-4" />
                <AlertTitle>使用默认参数</AlertTitle>
                <AlertDescription>{usedDefaults.join(', ')}</AlertDescription>
              </Alert>
            )}
            <section>
              <h3 className="text-sm font-medium">Steps</h3>
              <div className="mt-2 space-y-2">
                {run.stepRuns.map((step) => (
                  <div key={step.stepId} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-xs">{step.stepId}</span>
                      <Badge variant="outline" className="shrink-0">{step.status}</Badge>
                    </div>
                    {step.error && <p className="mt-2 text-xs text-destructive">{step.error}</p>}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

export function FolderPanel({
  preview,
  result,
  actionStatus,
  errorMessage,
  onImportFolder,
  onExportFolder,
}: {
  preview: WorkflowFolderImportPreview | null
  result: CompileResult | null
  actionStatus: 'idle' | 'importing' | 'exporting'
  errorMessage: string | null
  onImportFolder: () => void
  onExportFolder: () => void
}): React.ReactElement {
  const busy = actionStatus !== 'idle'
  const canExport = result?.validation.ok === true && result.yaml.trim().length > 0 && Boolean(result.workflow?.id)

  return (
    <ScrollArea className="h-full min-h-[320px] rounded-md border border-border/60 bg-background/70">
      <div className="space-y-4 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            <h3 className="truncate text-sm font-medium">Workflow Folder</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onImportFolder} disabled={busy}>
              {actionStatus === 'importing' ? <Loader2 className="animate-spin" /> : <FolderOpen />}
              导入目录
            </Button>
            <Button size="sm" variant="outline" onClick={onExportFolder} disabled={busy || !canExport}>
              {actionStatus === 'exporting' ? <Loader2 className="animate-spin" /> : <FolderOutput />}
              导出目录
            </Button>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>文件夹操作失败</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {!preview ? (
          <p className="text-muted-foreground">导入一个 workflow folder 后会显示 INTENT.md、manifest.json 和文件路径。</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCell label="Folder" value={preview.folderName} />
              <SummaryCell label="YAML" value={preview.workflowYamlPath} />
              <SummaryCell label="INTENT" value={preview.intentMdPath} />
              <SummaryCell label="Manifest" value={preview.manifestPath} />
              <SummaryCell label="Prompt" value={preview.promptMdPath} />
              <SummaryCell label="README" value={preview.readmePath} />
            </div>

            <WorkflowSummary result={result} />
            <ValidationPanel result={result} />

            <section>
              <h3 className="text-sm font-medium">INTENT.md</h3>
              <div className="mt-2">
                <CodeBlock value={preview.intentMarkdown ?? ''} empty="INTENT.md 不存在或为空。" />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium">manifest.json</h3>
              <div className="mt-2">
                <CodeBlock
                  value={preview.manifest ? JSON.stringify(preview.manifest, null, 2) : ''}
                  empty={preview.manifestError ?? 'manifest.json 不存在。'}
                />
              </div>
            </section>

            {preview.promptMarkdown != null && (
              <section>
                <h3 className="text-sm font-medium">prompt.md</h3>
                <div className="mt-2">
                  <CodeBlock value={preview.promptMarkdown} empty="prompt.md 为空。" />
                </div>
              </section>
            )}

            {preview.readmeMarkdown != null && (
              <section>
                <h3 className="text-sm font-medium">README.md</h3>
                <div className="mt-2">
                  <CodeBlock value={preview.readmeMarkdown} empty="README.md 为空。" />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}
