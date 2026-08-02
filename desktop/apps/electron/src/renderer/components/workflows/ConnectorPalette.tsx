import * as React from 'react'
import { ChevronRight, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { listCLIs, listCommunityMcpServers } from '@/lib/helios/client'
import type { CommunityMcpRegistryResponse, RegisteredCLI } from '@/lib/helios/types'
import type { WorkspaceCapabilities } from '@proma/shared'
import { ConnectorRegistryDialog } from './ConnectorRegistryDialog'
import { CURATED_OPEN_SOURCE_MCP_CATALOG } from './open-source-mcp-catalog'
import { buildCuratedOpenSourceMcpWorkspacePlan } from './connector-palette-helpers'

interface ConnectorPaletteProps {
  onInsert: (snippet: string) => void
  workspaceSlug?: string
  disabled?: boolean
}

export function ConnectorPalette({
  onInsert,
  workspaceSlug,
  disabled = false,
}: ConnectorPaletteProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [clis, setClis] = React.useState<RegisteredCLI[]>([])
  const [workspaceCaps, setWorkspaceCaps] = React.useState<WorkspaceCapabilities | null>(null)
  const [communityCatalog, setCommunityCatalog] = React.useState<CommunityMcpRegistryResponse | null>(null)
  const [loadingClis, setLoadingClis] = React.useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = React.useState(false)
  const [loadingCommunity, setLoadingCommunity] = React.useState(true)
  const [attachingOpenSourceId, setAttachingOpenSourceId] = React.useState<string | null>(null)
  const [workspaceRootPath, setWorkspaceRootPath] = React.useState<string | null>(null)
  const [cliError, setCliError] = React.useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null)
  const [communityError, setCommunityError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setLoadingClis(true)
    setCliError(null)
    void listCLIs()
      .then((items) => {
        if (!active) return
        setClis(items.slice().sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch((error: unknown) => {
        if (!active) return
        setClis([])
        setCliError(error instanceof Error ? error.message : '加载命令行连接器失败')
      })
      .finally(() => {
        if (active) setLoadingClis(false)
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    let active = true
    if (!workspaceSlug) {
      setWorkspaceCaps(null)
      setWorkspaceRootPath(null)
      setWorkspaceError(null)
      setLoadingWorkspace(false)
      return
    }
    setLoadingWorkspace(true)
    setWorkspaceError(null)
    void Promise.all([
      window.electronAPI.getWorkspaceCapabilities(workspaceSlug),
      window.electronAPI.listAgentWorkspaces(),
    ])
      .then(([caps, workspaces]) => {
        if (!active) return
        setWorkspaceCaps(caps)
        setWorkspaceRootPath(workspaces.find((workspace) => workspace.slug === workspaceSlug)?.projectRootPath ?? null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setWorkspaceCaps(null)
        setWorkspaceRootPath(null)
        setWorkspaceError(error instanceof Error ? error.message : '加载工作区平台失败')
      })
      .finally(() => {
        if (active) setLoadingWorkspace(false)
      })
    return () => {
      active = false
    }
  }, [workspaceSlug])

  React.useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoadingCommunity(true)
      setCommunityError(null)
      void listCommunityMcpServers(query, 50)
        .then((payload) => {
          if (!active) return
          setCommunityCatalog(payload)
        })
        .catch((error: unknown) => {
          if (!active) return
          setCommunityCatalog(null)
          setCommunityError(error instanceof Error ? error.message : '加载社区 MCP 目录失败')
        })
        .finally(() => {
          if (active) setLoadingCommunity(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const totalWorkspacePlatforms = (workspaceCaps?.builtinMcpServers.length ?? 0) + (workspaceCaps?.mcpServers.length ?? 0)
  const communityCount = communityCatalog?.metadata?.count ?? communityCatalog?.servers.length ?? 0
  const communityLoadedCount = communityCatalog?.servers.length ?? 0
  const openSourceCount = CURATED_OPEN_SOURCE_MCP_CATALOG.length

  const handleOpen = React.useCallback(() => {
    if (!disabled) setOpen(true)
  }, [disabled])

  const handleAttachOpenSource = React.useCallback(async (source: (typeof CURATED_OPEN_SOURCE_MCP_CATALOG)[number]) => {
    if (!workspaceSlug) {
      toast.error('请先选择一个工作区。')
      return
    }

    setAttachingOpenSourceId(source.id)
    try {
      const workspaceFilesPath = workspaceRootPath
        || await window.electronAPI.getWorkspaceFilesPath(workspaceSlug).catch(() => '')
      const plan = buildCuratedOpenSourceMcpWorkspacePlan(source, workspaceFilesPath || undefined)
      if (!plan) {
        toast.error('这个 MCP 还需要手动补全后再接入。')
        return
      }

      const caps = await window.electronAPI.upsertWorkspaceMcpServer(workspaceSlug, plan.name, plan.entry)
      setWorkspaceCaps(caps)
      setOpen(true)
      toast.success(plan.attachNote)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '接入工作区失败')
    } finally {
      setAttachingOpenSourceId(null)
    }
  }, [workspaceRootPath, workspaceSlug])

  return (
    <>
      <section className="rounded-md border border-border/60 bg-background/25 px-2.5 py-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-left transition-colors',
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-background/90',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-border/60 bg-background/70 p-1.5 text-primary">
                <Workflow className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">MCP 中心</h3>
                  <Badge variant="outline" className="font-mono text-[11px]">目录</Badge>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  开源 MCP、官方参考服务器、工作区和命令行一起看。
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">开源 {openSourceCount}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">命令行 {clis.length}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">平台 {totalWorkspacePlatforms}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">社区 {communityCount}</span>
              {communityLoadedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">已加载</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">{communityLoadedCount > 0 ? '展开' : '加载中'}</span>
            <ChevronRight className="size-4" />
          </div>
        </button>
      </section>

      <ConnectorRegistryDialog
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        workspaceSlug={workspaceSlug}
        workspaceCaps={workspaceCaps}
        communityCatalog={communityCatalog}
        clis={clis}
        loadingClis={loadingClis}
        loadingWorkspace={loadingWorkspace}
        loadingCommunity={loadingCommunity}
        cliError={cliError}
        workspaceError={workspaceError}
        communityError={communityError}
        onInsert={onInsert}
        onAttachOpenSource={handleAttachOpenSource}
        attachingOpenSourceId={attachingOpenSourceId}
        disabled={disabled}
      />
    </>
  )
}
