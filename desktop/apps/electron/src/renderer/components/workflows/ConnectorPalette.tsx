import * as React from 'react'
import { ChevronRight, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { listCLIs, listCommunityMcpServers } from '@/lib/helios/client'
import type { CommunityMcpRegistryResponse, RegisteredCLI } from '@/lib/helios/types'
import type { WorkspaceCapabilities } from '@proma/shared'
import { ConnectorRegistryDialog } from './ConnectorRegistryDialog'
import { buildCuratedOpenSourceMcpWorkspacePlan } from './connector-palette-helpers'
import type { CuratedOpenSourceMcp } from './open-source-mcp-catalog'

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

  const handleOpen = React.useCallback(() => {
    if (!disabled) setOpen(true)
  }, [disabled])

  const handleAttachOpenSource = React.useCallback(async (source: CuratedOpenSourceMcp) => {
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={disabled}
        className="shrink-0"
      >
        <Workflow className="size-4" />
        MCP 中心
        <ChevronRight className="size-4" />
      </Button>

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
