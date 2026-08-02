import * as React from 'react'
import { useAtomValue } from 'jotai'
import { AlertCircle, FileCode2, Loader2, Play, Save, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { compileIntent, saveWorkflow, startRun, validateWorkflowYaml, waitForRun } from '@/lib/helios/client'
import type { CompileResult, Workflow as HeliosWorkflow, WorkflowRun } from '@/lib/helios/types'
import { cn } from '@/lib/utils'
import type { WorkflowFolderImportPreview } from '@/types/workflow-folder'
import {
  FolderPanel,
  GraphPanel,
  RunPanel,
  ValidationBadge,
  ValidationPanel,
  WorkflowCardsPanel,
  WorkflowSourcePanel,
  WorkflowSummary,
  statusLabel,
  type StudioStatus,
} from './WorkflowStudioPanels'
import {
  buildFolderImportResult,
  buildStudioRunParams,
  canSaveDraft,
  getWorkflowDraftId,
} from './workflow-studio-helpers'
import { insertTextAtSelection } from './connector-palette-helpers'
import { ConnectorPalette } from './ConnectorPalette'

const SAMPLE_INTENT = '把线索 L-123 同步成采购单，写前要审批'

function childPath(folderPath: string, filename: string): string {
  const separator = folderPath.includes('\\') && !folderPath.includes('/') ? '\\' : '/'
  return `${folderPath.replace(/[/\\]$/, '')}${separator}${filename}`
}

export function WorkflowStudioView(): React.ReactElement {
  const intentRef = React.useRef<HTMLTextAreaElement | null>(null)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaceSlug = workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.slug
  const [intent, setIntent] = React.useState(SAMPLE_INTENT)
  const [result, setResult] = React.useState<CompileResult | null>(null)
  const [savedWorkflow, setSavedWorkflow] = React.useState<HeliosWorkflow | null>(null)
  const [run, setRun] = React.useState<WorkflowRun | null>(null)
  const [usedDefaults, setUsedDefaults] = React.useState<string[]>([])
  const [folderPreview, setFolderPreview] = React.useState<WorkflowFolderImportPreview | null>(null)
  const [status, setStatus] = React.useState<StudioStatus>('idle')
  const [folderStatus, setFolderStatus] = React.useState<'idle' | 'importing' | 'exporting'>('idle')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [folderErrorMessage, setFolderErrorMessage] = React.useState<string | null>(null)

  const yaml = result?.yaml ?? ''
  const workflowId = getWorkflowDraftId(result)
  const saveEnabled = canSaveDraft(result, yaml)
  const busy = status === 'compiling' || status === 'saving' || status === 'running' || folderStatus !== 'idle'

  const insertIntentSnippet = React.useCallback((snippet: string): void => {
    const textarea = intentRef.current
    const current = textarea?.value ?? intent
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    const insertion = start === end && start === current.length && current.trim().length > 0
      ? `\n\n${snippet}`
      : snippet
    const next = insertTextAtSelection(current, start, end, insertion)
    setIntent(next.value)
    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }, [intent])

  const resetRunState = React.useCallback(() => {
    setRun(null)
    setUsedDefaults([])
  }, [])

  const handleCompile = React.useCallback(async (repair = false): Promise<void> => {
    const trimmed = intent.trim()
    if (!trimmed) {
      setErrorMessage('请输入工作流目标。')
      setStatus('error')
      return
    }
    setStatus('compiling')
    setErrorMessage(null)
    setFolderErrorMessage(null)
    resetRunState()
    try {
      const compiled = await compileIntent(trimmed, repair && result ? {
        previousYaml: result.yaml,
        validationErrors: result.validation.errors,
      } : undefined)
      setResult(compiled)
      setSavedWorkflow(null)
      setFolderPreview(null)
      setStatus(compiled.validation.ok ? 'ready' : 'error')
      if (!compiled.validation.ok) {
        setErrorMessage('生成后的校验未通过，请查看校验结果。')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '生成失败')
    }
  }, [intent, resetRunState, result])

  const saveCurrentDraft = React.useCallback(async (): Promise<HeliosWorkflow | null> => {
    if (!result || !saveEnabled || !workflowId) {
      setErrorMessage('当前内容还不能保存。')
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

  const handleImportFolder = React.useCallback(async (): Promise<void> => {
    setFolderStatus('importing')
    setErrorMessage(null)
    setFolderErrorMessage(null)
    try {
      const selectedFolder = await window.electronAPI.openFolderDialog()
      if (!selectedFolder) {
        return
      }
      const folder = await window.electronAPI.readWorkflowFolder(selectedFolder.path)
      const validation = await validateWorkflowYaml(folder.workflowYaml)
      const imported = buildFolderImportResult(folder.workflowYaml, validation, folder.folderName)
      setResult(imported)
      setSavedWorkflow(null)
      setRun(null)
      setUsedDefaults([])
      setFolderPreview(folder)
      if (folder.intentMarkdown?.trim()) {
        setIntent(folder.intentMarkdown.trim())
      }
      setStatus(imported.validation.ok ? 'ready' : 'error')
      if (!imported.validation.ok) {
        setErrorMessage('文件夹导入后的工作流校验未通过，请查看校验结果。')
      } else {
        toast.success(`已导入 ${folder.folderName}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入工作流文件夹失败'
      setStatus('error')
      setErrorMessage(message)
      setFolderErrorMessage(message)
    } finally {
      setFolderStatus('idle')
    }
  }, [])

  const handleExportFolder = React.useCallback(async (): Promise<void> => {
    const workflow = savedWorkflow ?? result?.workflow
    if (!workflow || !result?.yaml.trim()) {
      setErrorMessage('当前内容还不能导出。')
      setStatus('error')
      return
    }
    setFolderStatus('exporting')
    setErrorMessage(null)
    setFolderErrorMessage(null)
    try {
      const exportRoot = folderPreview?.folderPath.replace(/[/\\][^/\\]+$/, '')
      const rootSelection = exportRoot || (await window.electronAPI.openFolderDialog())?.path
      if (!rootSelection) return
      const exported = await window.electronAPI.exportWorkflowFolder({
        rootPath: rootSelection,
        workflowId: workflow.id,
        workflowYaml: result.yaml,
        intentMarkdown: intent,
        workflowVersion: workflow.version,
        workflowDescription: workflow.description,
      })
      setFolderPreview({
        folderPath: exported.folderPath,
        folderName: exported.folderName,
        workflowYamlPath: exported.workflowYamlPath,
        workflowYaml: result.yaml,
        intentMdPath: exported.intentMdPath,
        intentMarkdown: intent,
        promptMdPath: childPath(exported.folderPath, 'prompt.md'),
        promptMarkdown: null,
        readmePath: childPath(exported.folderPath, 'README.md'),
        readmeMarkdown: null,
        manifestPath: exported.manifestPath,
        manifest: exported.manifest,
        manifestError: null,
      })
      toast.success(`已导出 ${workflow.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出工作流文件夹失败'
      setStatus('error')
      setErrorMessage(message)
      setFolderErrorMessage(message)
    } finally {
      setFolderStatus('idle')
    }
  }, [folderPreview?.folderPath, intent, result?.workflow, result?.yaml, savedWorkflow])

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
          <h1 className="text-2xl font-semibold tracking-tight text-wrap-balance">工作流工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">把自然语言变成可保存、可运行的工作流。</p>
        </div>
        <div className="titlebar-no-drag flex shrink-0 items-center gap-2">
          <Badge variant="outline">{statusLabel(status)}</Badge>
          <ValidationBadge result={result} />
        </div>
      </header>

      <main className="titlebar-no-drag grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-8 sm:px-8 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.4fr)] lg:overflow-hidden xl:px-10">
        <section className="flex min-h-[520px] flex-col rounded-lg border border-border/60 bg-background/35 lg:min-h-0">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="truncate text-sm font-medium">意图</h2>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectorPalette onInsert={insertIntentSnippet} workspaceSlug={workspaceSlug} disabled={busy} />
                  <Badge variant="outline" className="font-mono">{workflowId ?? '未生成'}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">先写一句业务目标，再点“生成”。生成后右侧才会出现卡片、步骤图和校验结果。</p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <Textarea
              ref={intentRef}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-foreground">操作</h3>
                <p className="text-[11px] text-muted-foreground">先生成，再保存和运行。</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => void handleCompile(false)} disabled={busy || intent.trim().length === 0}>
                  {status === 'compiling' ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  生成
                </Button>
                <Button variant="outline" onClick={() => void handleCompile(true)} disabled={busy || !result}>
                  <Wand2 />
                  修正
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
          </div>
        </section>

        <section className="flex min-h-[520px] flex-col rounded-lg border border-border/60 bg-background/35 lg:min-h-0">
          <Tabs defaultValue="cards" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <FileCode2 className="size-4 text-primary" />
                  <h2 className="truncate text-sm font-medium">工作流结果</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">先看卡片，再按需切到步骤图、校验、源码、运行和文件夹。</p>
              </div>
              <TabsList className="h-8 rounded-md">
                <TabsTrigger value="cards" className="h-6 rounded-sm px-2 text-xs">卡片</TabsTrigger>
                <TabsTrigger value="graph" className="h-6 rounded-sm px-2 text-xs">步骤图</TabsTrigger>
                <TabsTrigger value="validation" className="h-6 rounded-sm px-2 text-xs">校验</TabsTrigger>
                <TabsTrigger value="source" className="h-6 rounded-sm px-2 text-xs">源码</TabsTrigger>
                <TabsTrigger value="run" className="h-6 rounded-sm px-2 text-xs">运行状态</TabsTrigger>
                <TabsTrigger value="folder" className="h-6 rounded-sm px-2 text-xs">文件夹</TabsTrigger>
              </TabsList>
            </div>
            <div className={cn('min-h-0 flex-1 p-4', busy && 'cursor-progress')}>
              <TabsContent value="cards" className="m-0 h-full">
                <WorkflowCardsPanel result={result} />
              </TabsContent>
              <TabsContent value="graph" className="m-0 h-full">
                <GraphPanel result={result} run={run} />
              </TabsContent>
              <TabsContent value="validation" className="m-0 h-full">
                <ValidationPanel result={result} />
              </TabsContent>
              <TabsContent value="source" className="m-0 h-full">
                <WorkflowSourcePanel value={yaml} />
              </TabsContent>
              <TabsContent value="run" className="m-0 h-full">
                <RunPanel run={run} usedDefaults={usedDefaults} />
              </TabsContent>
              <TabsContent value="folder" className="m-0 h-full">
                <FolderPanel
                  preview={folderPreview}
                  result={result}
                  actionStatus={folderStatus}
                  errorMessage={folderErrorMessage}
                  onImportFolder={() => void handleImportFolder()}
                  onExportFolder={() => void handleExportFolder()}
                />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
