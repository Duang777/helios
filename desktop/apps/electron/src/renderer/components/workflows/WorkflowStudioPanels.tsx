import * as React from 'react'
import { AlertCircle, CheckCircle2, FileText, FolderOpen, FolderOutput, LayoutGrid, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WorkflowFolderImportPreview } from '@/types/workflow-folder'
import type { CompileResult, RunStatus, StepStatus, WorkflowRun } from '@/lib/helios/types'
import { getCompileAttempts, getWorkflowDraftId } from './workflow-studio-helpers'
import { WorkflowGraphPreview } from './WorkflowGraphPreview'

export type StudioStatus = 'idle' | 'compiling' | 'ready' | 'saving' | 'saved' | 'running' | 'error'

export function statusLabel(status: StudioStatus): string {
  switch (status) {
    case 'compiling':
      return '生成中'
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
      return '未生成'
  }
}

function formatCompileAttemptLabel(value?: string): string {
  switch (value) {
    case 'compile':
      return '生成'
    case 'repair':
      return '修正'
    default:
      return value ?? '生成'
  }
}

function formatRunStatus(status: RunStatus): string {
  switch (status) {
    case 'PENDING':
      return '等待中'
    case 'RUNNING':
      return '运行中'
    case 'WAITING_APPROVAL':
      return '等待审批'
    case 'WAITING_HUMAN':
      return '等待人工处理'
    case 'PAUSED':
      return '已暂停'
    case 'COMPLETED':
      return '已完成'
    case 'FAILED':
      return '失败'
    case 'ABORTED':
      return '已终止'
    default:
      return status
  }
}

function formatStepStatus(status: StepStatus): string {
  switch (status) {
    case 'PENDING':
      return '等待中'
    case 'READY':
      return '就绪'
    case 'RUNNING':
      return '运行中'
    case 'WAITING_APPROVAL':
      return '等待审批'
    case 'WAITING_HUMAN':
      return '等待人工处理'
    case 'SKIPPED':
      return '已跳过'
    case 'COMPLETED':
      return '已完成'
    case 'FAILED':
      return '失败'
    case 'ABORTED':
      return '已终止'
    default:
      return status
  }
}

export function ValidationBadge({ result }: { result: CompileResult | null }): React.ReactElement {
  if (!result) return <Badge variant="outline">未校验</Badge>
  if (result.validation.ok) {
    return (
      <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
        <CheckCircle2 className="size-3" />
        校验通过
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <AlertCircle className="size-3" />
      校验失败
    </Badge>
  )
}

export function WorkflowSummary({ result }: { result: CompileResult | null }): React.ReactElement {
  const workflow = result?.workflow
  const ir = result?.ir
  const id = getWorkflowDraftId(result)
  const steps = workflow?.steps ?? ir?.steps ?? []
  const params = workflow?.params ?? ir?.params ?? {}
  const modeLabel = formatCompileAttemptLabel(result?.mode)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-medium text-foreground">生成摘要</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">生成后会显示工作流 ID、步骤数、参数项和生成方式。</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[11px]">生成结果</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <SummaryCell label="工作流 ID" value={id ?? '待生成'} />
        <SummaryCell label="步骤数" value={String(steps.length)} />
        <SummaryCell label="参数项" value={String(Object.keys(params).length)} />
        <SummaryCell label="生成方式" value={modeLabel} />
      </div>
    </section>
  )
}

type WorkflowCardStep = {
  id: string
  uses: string
  description?: string
  prompt?: string
  cli?: string
  sideEffect?: string
  needs?: string[]
}

function getWorkflowCardSteps(result: CompileResult | null): WorkflowCardStep[] {
  const workflowSteps = result?.workflow?.steps
  if (workflowSteps?.length) {
    return workflowSteps.map((step) => ({
      id: step.id,
      uses: step.uses,
      description: step.description,
      prompt: step.prompt,
      cli: step.cli,
    }))
  }
  return (result?.ir?.steps ?? []).map((step) => ({
    id: step.id,
    uses: step.uses,
    prompt: step.prompt,
    cli: step.cli,
    sideEffect: step.sideEffect,
    needs: step.needs,
  }))
}

function SummaryCell({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/55 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
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
        {!result && <p className="text-muted-foreground">先在左侧点“生成”，这里会显示结构校验、警告和修正记录。</p>}
        {result && (
          <>
            <section>
              <h3 className="text-sm font-medium">校验结果</h3>
              {errors.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有校验错误。</p>
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
              <h3 className="text-sm font-medium">警告</h3>
              {warnings.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有警告。</p>
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
              <h3 className="text-sm font-medium">修正记录</h3>
              {attempts.length === 0 ? (
                <p className="mt-2 text-muted-foreground">没有修正记录。</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {attempts.map((attempt, index) => (
                    <div key={`${index}-${attempt.rawTraceId ?? attempt.error ?? attempt.yaml.length}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>第 {index + 1} 次</span>
                        <span>{formatCompileAttemptLabel(attempt.mode ?? attempt.model)}</span>
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

export function WorkflowCardsPanel({ result }: { result: CompileResult | null }): React.ReactElement {
  const workflow = result?.workflow
  const id = getWorkflowDraftId(result)
  const steps = getWorkflowCardSteps(result)
  const params = workflow?.params ?? result?.ir?.params ?? {}
  const description = workflow?.description ?? result?.ir?.description

  return (
    <div className="space-y-4">
      {!result ? (
        <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
          先在左侧点“生成”，这里会以卡片方式展示工作流、步骤和关键字段。
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <article className="rounded-md border border-border/60 bg-background/70 p-3">
              <div className="text-[11px] text-muted-foreground">工作流 ID</div>
              <div className="mt-1 truncate font-mono text-sm text-foreground">{id ?? '待生成'}</div>
            </article>
            <article className="rounded-md border border-border/60 bg-background/70 p-3">
              <div className="text-[11px] text-muted-foreground">步骤</div>
              <div className="mt-1 text-sm font-medium text-foreground">{steps.length}</div>
            </article>
            <article className="rounded-md border border-border/60 bg-background/70 p-3">
              <div className="text-[11px] text-muted-foreground">参数</div>
              <div className="mt-1 text-sm font-medium text-foreground">{Object.keys(params).length}</div>
            </article>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-primary" />
              <div>
                <h3 className="text-sm font-medium">工作流卡片</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">每一步都用卡片展示，源码放到单独的标签页里。</p>
              </div>
            </div>

            {description && (
              <article className="rounded-md border border-border/60 bg-background/70 p-4">
                <div className="text-[11px] text-muted-foreground">说明</div>
                <p className="mt-1 text-sm leading-6 text-foreground">{description}</p>
              </article>
            )}

            {steps.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
                这个结果里还没有步骤，先生成一个完整的工作流再看卡片。
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {steps.map((step, index) => (
                  <article key={step.id} className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[11px]">步骤 {index + 1}</Badge>
                          <h4 className="truncate text-sm font-semibold text-foreground">{step.id}</h4>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {step.description ?? step.prompt ?? '这个步骤暂时没有说明。'}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[11px]">{step.uses}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {step.cli && <Badge variant="secondary" className="text-[11px]">命令 {step.cli}</Badge>}
                      {step.sideEffect && <Badge variant="outline" className="text-[11px]">副作用 {step.sideEffect}</Badge>}
                      {step.needs?.length ? <Badge variant="outline" className="text-[11px]">前置 {step.needs.length}</Badge> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
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
        {!run && <p className="text-muted-foreground">保存并运行后会显示运行编号、状态和每个步骤的执行结果。</p>}
        {run && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SummaryCell label="运行编号" value={run.id} />
              <SummaryCell label="状态" value={formatRunStatus(run.status)} />
              <SummaryCell label="工作流" value={run.workflowId} />
            </div>
            {usedDefaults.length > 0 && (
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertCircle className="size-4" />
                <AlertTitle>使用默认参数</AlertTitle>
                <AlertDescription>{usedDefaults.join(', ')}</AlertDescription>
              </Alert>
            )}
            <section>
              <h3 className="text-sm font-medium">步骤</h3>
              <div className="mt-2 space-y-2">
                {run.stepRuns.map((step) => (
                  <div key={step.stepId} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-xs">{step.stepId}</span>
                      <Badge variant="outline" className="shrink-0">{formatStepStatus(step.status)}</Badge>
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

export function WorkflowSourcePanel({ value }: { value: string }): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-medium">源码</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">需要核对时再看源码，平时先看卡片。</p>
        </div>
      </div>
      <CodeBlock value={value} empty="先在左侧点“生成”，这里会显示工作流源码。" />
    </div>
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
            <h3 className="truncate text-sm font-medium">工作流文件夹</h3>
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
            <AlertTitle>工作流文件夹操作失败</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {!preview ? (
          <p className="text-muted-foreground">导入一个工作流文件夹后会显示意图文件、清单文件、提示词文件、说明文档和路径。</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCell label="文件夹" value={preview.folderName} />
              <SummaryCell label="工作流配置" value={preview.workflowYamlPath} />
              <SummaryCell label="意图文件" value={preview.intentMdPath} />
              <SummaryCell label="清单文件" value={preview.manifestPath} />
              <SummaryCell label="提示词文件" value={preview.promptMdPath} />
              <SummaryCell label="说明文档" value={preview.readmePath} />
            </div>

            <WorkflowSummary result={result} />
            <ValidationPanel result={result} />

            <section>
              <h3 className="text-sm font-medium">意图文件 INTENT.md</h3>
              <div className="mt-2">
                <CodeBlock value={preview.intentMarkdown ?? ''} empty="意图文件不存在或为空（INTENT.md）。" />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium">清单文件 manifest.json</h3>
              <div className="mt-2">
                <CodeBlock
                  value={preview.manifest ? JSON.stringify(preview.manifest, null, 2) : ''}
                  empty={preview.manifestError ?? '清单文件不存在（manifest.json）。'}
                />
              </div>
            </section>

            {preview.promptMarkdown != null && (
              <section>
                <h3 className="text-sm font-medium">提示词文件 prompt.md</h3>
                <div className="mt-2">
                  <CodeBlock value={preview.promptMarkdown} empty="提示词文件为空（prompt.md）。" />
                </div>
              </section>
            )}

            {preview.readmeMarkdown != null && (
              <section>
                <h3 className="text-sm font-medium">说明文档 README.md</h3>
                <div className="mt-2">
                  <CodeBlock value={preview.readmeMarkdown} empty="说明文档为空（README.md）。" />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}
