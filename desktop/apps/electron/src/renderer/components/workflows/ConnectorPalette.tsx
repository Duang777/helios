import * as React from 'react'
import { AlertCircle, Bot, Globe2, Loader2, Plus, Plug, Search, Workflow } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { listCLIs, listCommunityMcpServers } from '@/lib/helios/client'
import type { WorkspaceCapabilities, BuiltinMcpServerSummary } from '@proma/shared'
import type { CommunityMcpRegistryServerSummary, RegisteredCLI } from '@/lib/helios/types'
import {
  buildBuiltinMcpInsertText,
  buildCommunityMcpInsertText,
  buildConnectorInsertText,
  buildWorkspaceMcpInsertText,
  countConnectorCommands,
  filterBuiltinMcpCatalog,
  filterCommunityMcpCatalog,
  filterConnectorCatalog,
  filterWorkspaceMcpCatalog,
  formatBuiltinMcpTools,
  formatConnectorArg,
  formatConnectorCommandPath,
  formatMcpTransportLabel,
  matchesConnectorQuery,
} from './connector-palette-helpers'

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
  const [query, setQuery] = React.useState('')
  const [clis, setClis] = React.useState<RegisteredCLI[]>([])
  const [workspaceCaps, setWorkspaceCaps] = React.useState<WorkspaceCapabilities | null>(null)
  const [communityServers, setCommunityServers] = React.useState<CommunityMcpRegistryServerSummary[]>([])
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
      void listCommunityMcpServers(query, 12)
        .then((items) => {
          if (!active) return
          setCommunityServers(items.slice().sort((a, b) => a.title?.localeCompare(b.title ?? b.name) ?? a.name.localeCompare(b.name)))
        })
        .catch((error: unknown) => {
          if (!active) return
          setCommunityServers([])
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

  const filteredClis = React.useMemo(() => filterConnectorCatalog(clis, query), [clis, query])
  const filteredBuiltinMcp = React.useMemo(
    () => filterBuiltinMcpCatalog(workspaceCaps?.builtinMcpServers ?? [], query),
    [query, workspaceCaps?.builtinMcpServers],
  )
  const filteredWorkspaceMcp = React.useMemo(
    () => filterWorkspaceMcpCatalog(workspaceCaps?.mcpServers ?? [], query),
    [query, workspaceCaps?.mcpServers],
  )
  const filteredCommunityMcp = React.useMemo(
    () => filterCommunityMcpCatalog(communityServers, query),
    [communityServers, query],
  )

  const totalWorkspacePlatforms = (workspaceCaps?.builtinMcpServers.length ?? 0) + (workspaceCaps?.mcpServers.length ?? 0)

  const handleInsertCli = React.useCallback((cli: RegisteredCLI, commandIndex: number) => {
    const command = cli.introspect.commands[commandIndex]
    if (!command) return
    onInsert(buildConnectorInsertText(cli, command))
  }, [onInsert])

  const handleInsertBuiltin = React.useCallback((server: BuiltinMcpServerSummary) => {
    onInsert(buildBuiltinMcpInsertText(server))
  }, [onInsert])

  const handleInsertWorkspace = React.useCallback((name: string, type: WorkspaceCapabilities['mcpServers'][number]['type'], enabled: boolean) => {
    onInsert(buildWorkspaceMcpInsertText(name, type, enabled))
  }, [onInsert])

  const handleInsertCommunity = React.useCallback((server: CommunityMcpRegistryServerSummary) => {
    onInsert(buildCommunityMcpInsertText(server))
  }, [onInsert])

  return (
    <section className="flex max-h-[420px] flex-col rounded-md border border-border/60 bg-background/45">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <h3 className="truncate text-sm font-medium">Connector Registry</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            CLI、工作区 MCP、社区 MCP。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[11px]">registry</Badge>
      </div>

      <div className="border-b border-border/60 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索连接器、平台、命令或参数"
            className="h-9 pl-9"
            disabled={disabled}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="text-[11px]">CLI {clis.length}</Badge>
          <Badge variant="secondary" className="text-[11px]">平台 {totalWorkspacePlatforms}</Badge>
          <Badge variant="secondary" className="text-[11px]">社区 {communityServers.length}</Badge>
        </div>
      </div>

      {(cliError || workspaceError) && (
        <div className="border-b border-border/60 px-4 py-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>连接器加载失败</AlertTitle>
            <AlertDescription>{cliError ?? workspaceError}</AlertDescription>
          </Alert>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <RegistryGroup
            title="社区 MCP"
            meta="registry"
            count={String(filteredCommunityMcp.length)}
          >
            {loadingCommunity ? (
              <LoadingState label="正在加载社区 MCP 目录..." />
            ) : communityError ? (
              <EmptyState text={`社区 MCP 暂时不可用：${communityError}`} />
            ) : filteredCommunityMcp.length === 0 ? (
              <EmptyState text="没有匹配的社区 MCP。" />
            ) : filteredCommunityMcp.map((server) => (
              <RegistryItem
                key={server.name}
                title={server.title ?? server.name}
                subtitle={server.description ?? server.installHint ?? '来自 MCP Registry'}
                badges={(
                  <>
                    <Badge variant="outline" className="text-[11px]">{server.transport ?? 'unknown'}</Badge>
                    {server.version && <Badge variant="outline" className="text-[11px]">{server.version}</Badge>}
                    {server.status && <Badge variant={server.status === 'active' ? 'secondary' : 'outline'} className="text-[11px]">{server.status}</Badge>}
                  </>
                )}
                extraLine={server.installHint}
                action={(
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => handleInsertCommunity(server)}
                    disabled={disabled}
                  >
                    <Plus className="size-4" />
                    插入
                  </Button>
                )}
                icon={<Globe2 className="size-4 text-primary" />}
              />
            ))}
          </RegistryGroup>

          <RegistryGroup
            title="内置平台"
            meta={String(workspaceCaps?.builtinMcpServers.length ?? 0)}
            count={String(filteredBuiltinMcp.length)}
          >
            {filteredBuiltinMcp.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border/60 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
                {loadingWorkspace ? '正在加载工作区平台...' : '没有匹配的内置平台。'}
              </div>
            ) : filteredBuiltinMcp.map((server) => (
              <RegistryItem
                key={server.id}
                title={server.displayName}
                subtitle={server.description}
                badges={(
                  <>
                    <Badge variant="outline" className="text-[11px]">{server.category}</Badge>
                    <Badge variant={server.available ? 'secondary' : 'outline'} className="text-[11px]">
                      {server.available ? '可用' : (server.availabilityReason ?? '不可用')}
                    </Badge>
                  </>
                )}
                extraLine={formatBuiltinMcpTools(server)}
                action={(
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => handleInsertBuiltin(server)}
                    disabled={disabled}
                  >
                    <Plus className="size-4" />
                    插入
                  </Button>
                )}
                icon={<Bot className="size-4 text-primary" />}
              />
            ))}
          </RegistryGroup>

          <RegistryGroup
            title="工作区 MCP"
            meta={workspaceSlug || 'workspace'}
            count={String(filteredWorkspaceMcp.length)}
          >
            {loadingWorkspace ? (
              <LoadingState label="正在加载工作区 MCP..." />
            ) : !workspaceSlug ? (
              <EmptyState text="先选择一个工作区，再查看该项目可接入的 MCP。" />
            ) : filteredWorkspaceMcp.length === 0 ? (
              <EmptyState text="没有匹配的工作区 MCP。" />
            ) : filteredWorkspaceMcp.map((server) => (
              <RegistryItem
                key={server.name}
                title={server.name}
                subtitle={server.enabled ? '当前启用' : '当前关闭'}
                badges={(
                  <>
                    <Badge variant="outline" className="text-[11px]">{formatMcpTransportLabel(server.type)}</Badge>
                    <Badge variant={server.enabled ? 'secondary' : 'outline'} className="text-[11px]">
                      {server.enabled ? '启用' : '关闭'}
                    </Badge>
                  </>
                )}
                action={(
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => handleInsertWorkspace(server.name, server.type, server.enabled)}
                    disabled={disabled}
                  >
                    <Plus className="size-4" />
                    插入
                  </Button>
                )}
                icon={<Plug className="size-4 text-primary" />}
              />
            ))}
          </RegistryGroup>

          <RegistryGroup
            title="CLI"
            meta={String(clis.length)}
            count={String(filteredClis.length)}
          >
            {loadingClis ? (
              <LoadingState label="正在加载可用 CLI..." />
            ) : filteredClis.length === 0 ? (
              <EmptyState text="没有匹配的 CLI 连接器。" />
            ) : filteredClis.map((cli) => {
              const visibleCommands = cli.introspect.commands.filter((command) => matchesConnectorQuery(cli, command, query))
              return (
                <RegistryGroup
                  key={`${cli.name}-${cli.version}`}
                  title={cli.name}
                  meta={cli.version}
                  count={`${visibleCommands.length}/${countConnectorCommands(cli)}`}
                >
                  {visibleCommands.map((command) => {
                    const originalIndex = cli.introspect.commands.findIndex((item) => item.path.join(' ') === command.path.join(' '))
                    const argSummary = command.args?.length
                      ? command.args.map(formatConnectorArg).join(' · ')
                      : '无额外参数'

                    return (
                      <RegistryItem
                        key={`${cli.name}-${formatConnectorCommandPath(command)}`}
                        title={formatConnectorCommandPath(command)}
                        subtitle={argSummary}
                        badges={(
                          <>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px]',
                                command.sideEffect === 'write' && 'border-rose-500/40 text-rose-600 dark:text-rose-300',
                                command.sideEffect === 'read' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300',
                              )}
                            >
                              {command.sideEffect}
                            </Badge>
                            {command.dryRun && <Badge variant="outline" className="text-[11px]">dry-run</Badge>}
                          </>
                        )}
                        action={(
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => handleInsertCli(cli, originalIndex >= 0 ? originalIndex : 0)}
                            disabled={disabled}
                          >
                            <Plus className="size-4" />
                            插入
                          </Button>
                        )}
                      />
                    )
                  })}
                </RegistryGroup>
              )
            })}
          </RegistryGroup>
        </div>
      </ScrollArea>
    </section>
  )
}

function LoadingState({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function EmptyState({ text }: { text: string }): React.ReactElement {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function RegistryGroup({
  title,
  meta,
  count,
  children,
}: {
  title: string
  meta: string
  count: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <Badge variant="outline" className="font-mono text-[11px]">{meta}</Badge>
        </div>
        <Badge variant="secondary" className="text-[11px]">{count}</Badge>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}

function RegistryItem({
  title,
  subtitle,
  badges,
  action,
  icon,
  extraLine,
}: {
  title: string
  subtitle: string
  badges: React.ReactNode
  action: React.ReactNode
  icon?: React.ReactNode
  extraLine?: string
}): React.ReactElement {
  return (
    <div className="rounded-sm border border-border/60 bg-background/80 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {icon}
            <span className="truncate font-medium text-foreground">{title}</span>
            {badges}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          {extraLine && <p className="mt-1 text-[11px] text-muted-foreground/80">{extraLine}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
