import * as React from 'react'
import { AlertCircle, FileCode2, Loader2, Play, Save, Sparkles, Wand2, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { compileIntent, saveWorkflow, startRun, waitForRun } from '@/lib/helios/client'
import type { CompileResult, Workflow as HeliosWorkflow, WorkflowRun } from '@/lib/helios/types'
import { cn } from '@/lib/utils'
import {
  CodeBlock,
  GraphPanel,
  IRPanel,
  RunPanel,
  ValidationBadge,
  ValidationPanel,
  WorkflowSummary,
  statusLabel,
  type StudioStatus,
} from './WorkflowStudioPanels'
import {
  buildStudioRunParams,
  canSaveDraft,
  getWorkflowDraftId,
} from './workflow-studio-helpers'

const SAMPLE_INTENT = '把线索 L-123 同步成采购单，写前要审批'

export function WorkflowStudioView(): React.ReactElement {
  const [intent, setIntent] = React.useState(SAMPLE_INTENT)
  const [result, setResult] = React.useState<CompileResult | null>(null)
  const [savedWorkflow, setSavedWorkflow] = React.useState<HeliosWorkflow | null>(null)
  const [run, setRun] = React.useState<WorkflowRun | null>(null)
  const [usedDefaults, setUsedDefaults] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<StudioStatus>('idle')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const yaml = result?.yaml ?? ''
  const workflowId = getWorkflowDraftId(result)
  const saveEnabled = canSaveDraft(result, yaml)
  const busy = status === 'compiling' || status === 'saving' || status === 'running'

  const handleCompile = React.useCallback(async (repair = false): Promise<void> => {
    const trimmed = intent.trim()
    if (!trimmed) {
      setErrorMessage('请输入 workflow 目标。')
      setStatus('error')
      return
    }
    setStatus('compiling')
    setErrorMessage(null)
    setRun(null)
    setUsedDefaults([])
    try {
      const compiled = await compileIntent(trimmed, repair && result ? {
        previousYaml: result.yaml,
        validationErrors: result.validation.errors,
      } : undefined)
      setResult(compiled)
      setSavedWorkflow(null)
      setStatus(compiled.validation.ok ? 'ready' : 'error')
      if (!compiled.validation.ok) {
        setErrorMessage('后端校验未通过，请查看 Validation。')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '编译失败')
    }
  }, [intent, result])

  const saveCurrentDraft = React.useCallback(async (): Promise<HeliosWorkflow | null> => {
    if (!result || !saveEnabled || !workflowId) {
      setErrorMessage('当前草稿还不能保存。')
      setStatus('error')
      return null
    }
    setStatus('saving')
    setErrorMessage(null)
    try {
      const workflow = await saveWorkflow(workflowId, yaml)
      setSavedWorkflow(workflow)
      setStatus('saved')
      toast.success(`已保存 ${workflow.id}`)
      return workflow
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '保存失败')
      return null
    }
  }, [result, saveEnabled, workflowId, yaml])

  const handleRun = React.useCallback(async (): Promise<void> => {
    const workflow = savedWorkflow ?? await saveCurrentDraft()
    if (!workflow) return
    const paramsResult = buildStudioRunParams(intent, workflow)
    setStatus('running')
    setErrorMessage(null)
    setUsedDefaults(paramsResult.usedDefaults)
    try {
      const started = await startRun(workflow.id, paramsResult.params)
      setRun(started)
      const finished = await waitForRun(started.id, { timeoutMs: 45_000, intervalMs: 800 })
      setRun(finished)
      setStatus('saved')
      toast.success(`运行状态：${finished.status}`)
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '运行失败')
    }
  }, [intent, saveCurrentDraft, savedWorkflow])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-content-area">
      <header className="titlebar-drag-region flex w-full items-start justify-between gap-4 px-6 pb-4 pt-8 sm:px-8 xl:px-10">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Workflow className="size-4" />
            <span className="text-xs font-medium uppercase">Helios</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-wrap-balance">Workflow Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">把自然语言编译成可保存、可运行的 Helios workflow。</p>
        </div>
        <div className="titlebar-no-drag flex shrink-0 items-center gap-2">
          <Badge variant="outline">{statusLabel(status)}</Badge>
          <ValidationBadge result={result} />
        </div>
      </header>

      <main className="titlebar-no-drag grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-8 sm:px-8 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.4fr)] lg:overflow-hidden xl:px-10">
        <section className="flex min-h-[520px] flex-col rounded-lg border border-border/60 bg-background/35 lg:min-h-0">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="truncate text-sm font-medium">Intent</h2>
              </div>
              <Badge variant="outline" className="font-mono">{workflowId ?? 'draft'}</Badge>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <Textarea
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              className="min-h-[180px] flex-1 resize-none text-sm leading-relaxed"
              placeholder="描述你要自动化的业务流程..."
              disabled={busy}
            />
            <WorkflowSummary result={result} />
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>操作失败</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void handleCompile(false)} disabled={busy || intent.trim().length === 0}>
                {status === 'compiling' ? <Loader2 className="animate-spin" /> : <Wand2 />}
                编译
              </Button>
              <Button variant="outline" onClick={() => void handleCompile(true)} disabled={busy || !result}>
                <Wand2 />
                修复
              </Button>
              <Button variant="secondary" onClick={() => void saveCurrentDraft()} disabled={busy || !saveEnabled}>
                {status === 'saving' ? <Loader2 className="animate-spin" /> : <Save />}
                保存
              </Button>
              <Button variant="secondary" onClick={() => void handleRun()} disabled={busy || !saveEnabled}>
                {status === 'running' ? <Loader2 className="animate-spin" /> : <Play />}
                运行
              </Button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[520px] flex-col rounded-lg border border-border/60 bg-background/35 lg:min-h-0">
          <Tabs defaultValue="yaml" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode2 className="size-4 text-primary" />
                <h2 className="truncate text-sm font-medium">Draft output</h2>
              </div>
              <TabsList className="h-8 rounded-md">
                <TabsTrigger value="yaml" className="h-6 rounded-sm px-2 text-xs">YAML</TabsTrigger>
                <TabsTrigger value="graph" className="h-6 rounded-sm px-2 text-xs">Graph</TabsTrigger>
                <TabsTrigger value="validation" className="h-6 rounded-sm px-2 text-xs">Validation</TabsTrigger>
                <TabsTrigger value="ir" className="h-6 rounded-sm px-2 text-xs">IR</TabsTrigger>
                <TabsTrigger value="run" className="h-6 rounded-sm px-2 text-xs">Run</TabsTrigger>
              </TabsList>
            </div>
            <div className={cn('min-h-0 flex-1 p-4', busy && 'cursor-progress')}>
              <TabsContent value="yaml" className="m-0 h-full">
                <CodeBlock value={yaml} empty="编译后会显示 Helios YAML。" />
              </TabsContent>
              <TabsContent value="graph" className="m-0 h-full">
                <GraphPanel result={result} run={run} />
              </TabsContent>
              <TabsContent value="validation" className="m-0 h-full">
                <ValidationPanel result={result} />
              </TabsContent>
              <TabsContent value="ir" className="m-0 h-full">
                <IRPanel ir={result?.ir} />
              </TabsContent>
              <TabsContent value="run" className="m-0 h-full">
                <RunPanel run={run} usedDefaults={usedDefaults} />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
