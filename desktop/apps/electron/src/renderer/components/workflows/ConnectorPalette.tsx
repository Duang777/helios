import * as React from 'react'
import { ChevronRight, Command, Globe2, Plug, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { listCLIs, listCommunityMcpServers } from '@/lib/helios/client'
import type { CommunityMcpRegistryResponse, RegisteredCLI } from '@/lib/helios/types'
import type { WorkspaceCapabilities } from '@proma/shared'
import { ConnectorRegistryDialog } from './ConnectorRegistryDialog'

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
        setCliError(error instanceof Error ? error.message : '加载 CLI 连接器失败')
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
      setWorkspaceError(null)
      setLoadingWorkspace(false)
      return
    }
    setLoadingWorkspace(true)
    setWorkspaceError(null)
    void window.electronAPI.getWorkspaceCapabilities(workspaceSlug)
      .then((caps) => {
        if (!active) return
        setWorkspaceCaps(caps)
      })
      .catch((error: unknown) => {
        if (!active) return
        setWorkspaceCaps(null)
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

  const handleOpen = React.useCallback(() => {
    if (!disabled) setOpen(true)
  }, [disabled])

  return (
    <>
      <section className="rounded-lg border border-border/60 bg-background/35 px-3 py-2.5">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-background/75 px-3 py-2.5 text-left transition-colors',
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-background/90',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-border/60 bg-background/60 p-1.5 text-primary">
                <Workflow className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">MCP 中心</h3>
                  <Badge variant="outline" className="font-mono text-[11px]">registry</Badge>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  点开浏览 CLI、工作区 MCP、内置平台和社区目录。
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="text-[11px]">CLI {clis.length}</Badge>
              <Badge variant="secondary" className="text-[11px]">平台 {totalWorkspacePlatforms}</Badge>
              <Badge variant="secondary" className="text-[11px]">社区 {communityCount}</Badge>
              {communityLoadedCount > 0 && <Badge variant="outline" className="text-[11px]">已加载</Badge>}
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
        disabled={disabled}
      />
    </>
  )
}
