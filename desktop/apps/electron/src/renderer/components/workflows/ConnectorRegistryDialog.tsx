import * as React from 'react'
import { AlertCircle, ArrowRight, BookOpen, Bot, Command, Globe2, Loader2, Plug, Search, Workflow, X, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { BuiltinMcpServerSummary, WorkspaceCapabilities } from '@proma/shared'
import type { CommunityMcpRegistryResponse, CommunityMcpRegistryServerSummary, RegisteredCLI } from '@/lib/helios/types'
import {
  buildBuiltinMcpInsertText,
  buildCommunityMcpInsertText,
  buildConnectorInsertText,
  buildOpenSourceMcpInsertText,
  buildWorkspaceMcpInsertText,
  countConnectorCommands,
  filterBuiltinMcpCatalog,
  filterCommunityMcpCatalog,
  filterConnectorCatalog,
  filterOpenSourceMcpCatalog,
  filterConnectorCommands,
  filterWorkspaceMcpCatalog,
  formatBuiltinMcpTools,
  formatConnectorArg,
  formatConnectorCommandPath,
  formatConnectorSideEffect,
  formatCommunityTransportLabel,
  formatMcpTransportLabel,
  getCuratedOpenSourceMcpWorkspaceName,
} from './connector-palette-helpers'
import { CURATED_OPEN_SOURCE_MCP_CATALOG, type CuratedOpenSourceMcp } from './open-source-mcp-catalog'

type ConnectorRegistrySource = 'all' | 'opensource' | 'community' | 'workspace' | 'builtin' | 'cli'

interface ConnectorRegistryDialogProps {
  open: boolean
  query: string
  onQueryChange: (query: string) => void
  onOpenChange: (open: boolean) => void
  workspaceSlug?: string
  workspaceCaps: WorkspaceCapabilities | null
  communityCatalog: CommunityMcpRegistryResponse | null
  clis: RegisteredCLI[]
  loadingClis: boolean
  loadingWorkspace: boolean
  loadingCommunity: boolean
  cliError: string | null
  workspaceError: string | null
  communityError: string | null
  disabled?: boolean
  onInsert: (snippet: string) => void
  onAttachOpenSource: (source: CuratedOpenSourceMcp) => void
  attachingOpenSourceId: string | null
}

export function ConnectorRegistryDialog({
  open,
  query,
  onQueryChange,
  onOpenChange,
  workspaceSlug,
  workspaceCaps,
  communityCatalog,
  clis,
  loadingClis,
  loadingWorkspace,
  loadingCommunity,
  cliError,
  workspaceError,
  communityError,
  disabled = false,
  onInsert,
  onAttachOpenSource,
  attachingOpenSourceId,
}: ConnectorRegistryDialogProps): React.ReactElement {
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [source, setSource] = React.useState<ConnectorRegistrySource>('all')

  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  React.useEffect(() => {
    if (open) setSource('all')
  }, [open])

  const communityServers = communityCatalog?.servers ?? []
  const communityCount = communityCatalog?.metadata?.count ?? communityServers.length
  const communityHasMore = Boolean(communityCatalog?.metadata?.nextCursor)
  const workspaceBuiltin = workspaceCaps?.builtinMcpServers ?? []
  const workspaceServers = workspaceCaps?.mcpServers ?? []
  const workspaceServerNames = React.useMemo(
    () => new Set(workspaceServers.map((server) => server.name)),
    [workspaceServers],
  )
  const workspaceServerEnabledMap = React.useMemo(
    () => new Map(workspaceServers.map((server) => [server.name, server.enabled] as const)),
    [workspaceServers],
  )
  const openSourceMcp = CURATED_OPEN_SOURCE_MCP_CATALOG

  const filteredOpenSourceMcp = React.useMemo(
    () => filterOpenSourceMcpCatalog(openSourceMcp, query),
    [openSourceMcp, query],
  )
  const filteredCommunityMcp = React.useMemo(
    () => filterCommunityMcpCatalog(communityServers, query),
    [communityServers, query],
  )
  const filteredBuiltinMcp = React.useMemo(
    () => filterBuiltinMcpCatalog(workspaceBuiltin, query),
    [query, workspaceBuiltin],
  )
  const filteredWorkspaceMcp = React.useMemo(
    () => filterWorkspaceMcpCatalog(workspaceServers, query),
    [query, workspaceServers],
  )
  const filteredClis = React.useMemo(
    () => filterConnectorCatalog(clis, query),
    [clis, query],
  )
  const filteredCliCommands = React.useMemo(() => {
    return filteredClis.flatMap((cli) =>
      filterConnectorCommands(cli, query).map((command) => ({ cli, command })),
    )
  }, [filteredClis, query])

  const totalWorkspacePlatforms = workspaceBuiltin.length + workspaceServers.length
  const totalCliCommands = clis.reduce((sum, cli) => sum + countConnectorCommands(cli), 0)
  const isLoadingVisibleSection = (
    ((source === 'all' || source === 'cli') && loadingClis)
    || ((source === 'all' || source === 'workspace' || source === 'builtin') && loadingWorkspace)
    || ((source === 'all' || source === 'community') && loadingCommunity)
  )
  const visibleSections = React.useMemo<ConnectorRegistrySource[]>(() => {
    if (source === 'all') return ['opensource', 'community', 'workspace', 'builtin', 'cli']
    if (source === 'opensource') return ['opensource']
    return [source]
  }, [source])
  const hasVisibleResults = React.useMemo(() => {
    if (source === 'all') {
      return (
        filteredOpenSourceMcp.length > 0 ||
        filteredCommunityMcp.length > 0 ||
        filteredWorkspaceMcp.length > 0 ||
        filteredBuiltinMcp.length > 0 ||
        filteredCliCommands.length > 0
      )
    }
    if (source === 'opensource') return filteredOpenSourceMcp.length > 0
    if (source === 'community') return filteredCommunityMcp.length > 0
    if (source === 'workspace') return filteredWorkspaceMcp.length > 0
    if (source === 'builtin') return filteredBuiltinMcp.length > 0
    return filteredCliCommands.length > 0
  }, [
    filteredOpenSourceMcp.length,
    source,
    filteredBuiltinMcp.length,
    filteredCliCommands.length,
    filteredCommunityMcp.length,
    filteredWorkspaceMcp.length,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="!h-[min(860px,calc(100vh-2rem))] !max-w-none !w-[min(1240px,calc(100vw-2rem))] overflow-hidden p-0">
        <DialogTitle className="sr-only">MCP 中心</DialogTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="rounded-md border border-border/60 bg-background/70 p-2 text-primary">
                  <Workflow className="size-4" />
                </div>
                <div className="min-w-0">
                  <DialogDescription className="text-xs uppercase tracking-wide text-muted-foreground">目录</DialogDescription>
                  <h2 className="text-lg font-semibold text-foreground">MCP 中心</h2>
                </div>
                <Badge variant="outline" className="font-mono text-[11px]">桌面</Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                开源 MCP、官方目录、工作区和命令行放在同一个浏览面板里，直接插入即可。
              </p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="关闭 MCP 中心">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Tabs value={source} onValueChange={(value) => setSource(value as ConnectorRegistrySource)} className="w-full xl:flex-1">
                <TabsList className="grid h-9 w-full grid-cols-6 rounded-md">
                  <TabsTrigger value="all" className="h-8 text-xs">全部</TabsTrigger>
                  <TabsTrigger value="opensource" className="h-8 text-xs">开源</TabsTrigger>
                  <TabsTrigger value="community" className="h-8 text-xs">社区</TabsTrigger>
                  <TabsTrigger value="workspace" className="h-8 text-xs">工作区</TabsTrigger>
                  <TabsTrigger value="builtin" className="h-8 text-xs">平台</TabsTrigger>
                  <TabsTrigger value="cli" className="h-8 text-xs">命令行</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full xl:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="搜索连接器、平台、命令或参数"
                  className="h-9 pl-9"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">当前目录</span>
              <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">开源 {filteredOpenSourceMcp.length}/{openSourceMcp.length}</span>
              <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">命令行 {filteredCliCommands.length}/{totalCliCommands}</span>
              <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">工作区 {filteredWorkspaceMcp.length}/{workspaceServers.length}</span>
              <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">平台 {filteredBuiltinMcp.length}/{workspaceBuiltin.length}</span>
              <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">社区 {filteredCommunityMcp.length}/{communityCount}</span>
              {communityHasMore && <span className="rounded-full border border-border/60 bg-background/65 px-2 py-0.5">可继续浏览</span>}
            </div>

            {(cliError || workspaceError || communityError) && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>连接器加载失败</AlertTitle>
                <AlertDescription>{cliError ?? workspaceError ?? communityError}</AlertDescription>
              </Alert>
            )}

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 pr-4">
                {visibleSections.includes('opensource') && (
                  <ConnectorSection
                    title="开源 MCP"
                    description="可直接接入的开源项目与官方参考服务器，带可复制命令和源码地址。"
                    count={String(filteredOpenSourceMcp.length)}
                    meta="开源"
                  >
                    {filteredOpenSourceMcp.length === 0 ? (
                      <EmptyState text="没有匹配的开源 MCP。换个关键词再试试。" />
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {filteredOpenSourceMcp.map((sourceItem) => (
                          <OpenSourceMcpCard
                            key={sourceItem.id}
                            source={sourceItem}
                            onInsert={onInsert}
                            onAttach={onAttachOpenSource}
                            attached={workspaceServerNames.has(getCuratedOpenSourceMcpWorkspaceName(sourceItem))}
                            attachedEnabled={workspaceServerEnabledMap.get(getCuratedOpenSourceMcpWorkspaceName(sourceItem)) ?? false}
                            attaching={attachingOpenSourceId === sourceItem.id}
                            canAttach={Boolean(workspaceSlug)}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    )}
                  </ConnectorSection>
                )}

                {visibleSections.includes('community') && (
                  <ConnectorSection
                    title="社区 MCP"
                    description="来自社区 MCP 目录，适合快速找到现成业务平台。"
                    count={communityCatalog?.metadata?.count ? `${filteredCommunityMcp.length}/${communityCatalog.metadata.count}` : String(filteredCommunityMcp.length)}
                    meta={communityHasMore ? '可继续浏览' : '目录'}
                  >
                    {loadingCommunity ? (
                      <LoadingState label="正在加载社区 MCP 目录..." />
                    ) : filteredCommunityMcp.length === 0 ? (
                      <EmptyState text="没有匹配的社区 MCP。换个关键词再试试。" />
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {filteredCommunityMcp.map((server) => (
                          <CommunityMcpCard
                            key={server.name}
                            server={server}
                            onInsert={onInsert}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    )}
                  </ConnectorSection>
                )}

                {visibleSections.includes('workspace') && (
                  <ConnectorSection
                    title="工作区 MCP"
                    description="当前项目已经配置好的 MCP 连接器。"
                    count={String(filteredWorkspaceMcp.length)}
                    meta={workspaceSlug || 'workspace'}
                  >
                    {loadingWorkspace ? (
                      <LoadingState label="正在加载工作区 MCP..." />
                    ) : !workspaceSlug ? (
                      <EmptyState text="先选择一个工作区，再看这个项目能接入哪些 MCP。" />
                    ) : filteredWorkspaceMcp.length === 0 ? (
                      <EmptyState text="没有匹配的工作区 MCP。" />
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {filteredWorkspaceMcp.map((server) => (
                          <WorkspaceMcpCard
                            key={server.name}
                            server={server}
                            onInsert={onInsert}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    )}
                  </ConnectorSection>
                )}

                {visibleSections.includes('builtin') && (
                  <ConnectorSection
                    title="内置平台"
                    description="Helios 自带的平台能力，适合直接插入到工作流草稿。"
                    count={String(filteredBuiltinMcp.length)}
                    meta={String(workspaceBuiltin.length)}
                  >
                    {loadingWorkspace ? (
                      <LoadingState label="正在加载内置平台..." />
                    ) : filteredBuiltinMcp.length === 0 ? (
                      <EmptyState text="没有匹配的内置平台。" />
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {filteredBuiltinMcp.map((server) => (
                          <BuiltinMcpCard
                            key={server.id}
                            server={server}
                            onInsert={onInsert}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    )}
                  </ConnectorSection>
                )}

                {visibleSections.includes('cli') && (
                  <ConnectorSection
                    title="命令行"
                    description="按命令维度展示本地命令行连接器，适合直接编进草稿。"
                    count={String(filteredCliCommands.length)}
                    meta="命令行"
                  >
                    {loadingClis ? (
                      <LoadingState label="正在加载可用命令行连接器..." />
                    ) : filteredClis.length === 0 ? (
                      <EmptyState text="没有匹配的命令行连接器。" />
                    ) : filteredCliCommands.length === 0 ? (
                      <EmptyState text="没有匹配的命令行命令。" />
                    ) : (
                      <div className="space-y-4">
                        {filteredClis.map((cli) => {
                          const visibleCommands = filterConnectorCommands(cli, query)
                          if (visibleCommands.length === 0) return null
                          return (
                            <div key={`${cli.name}-${cli.version}`} className="space-y-3">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-foreground">{cli.name}</h4>
                                <Badge variant="outline" className="font-mono text-[11px]">{cli.version}</Badge>
                                <Badge variant="secondary" className="text-[11px]">{visibleCommands.length}/{countConnectorCommands(cli)}</Badge>
                              </div>
                              <div className="grid gap-3 xl:grid-cols-2">
                                {visibleCommands.map((command) => (
                                  <CliCommandCard
                                    key={`${cli.name}-${formatConnectorCommandPath(command)}`}
                                    cli={cli}
                                    command={command}
                                    onInsert={onInsert}
                                    disabled={disabled}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ConnectorSection>
                )}

                {!isLoadingVisibleSection && !hasVisibleResults && (
                  <EmptyState text="没有找到可插入的连接器。换个关键词，或者切换源分类。">
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onQueryChange('')} disabled={disabled}>
                        清空搜索
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSource('all')} disabled={disabled}>
                        查看全部
                      </Button>
                    </div>
                  </EmptyState>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConnectorSection({
  title,
  description,
  count,
  meta,
  children,
}: {
  title: string
  description: string
  count: string
  meta: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="outline" className="font-mono text-[11px]">{meta}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[11px]">{count}</Badge>
      </div>
      {children}
    </section>
  )
}

function CommunityMcpCard({
  server,
  onInsert,
  disabled,
}: {
  server: CommunityMcpRegistryServerSummary
  onInsert: (snippet: string) => void
  disabled: boolean
}): React.ReactElement {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Globe2 className="size-4 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-semibold text-foreground">{server.title ?? server.name}</h4>
            {server.transport && <Badge variant="outline" className="text-[11px]">{formatCommunityTransportLabel(server.transport)}</Badge>}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {server.description ?? server.installHint ?? '来自社区 MCP 目录'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onInsert(buildCommunityMcpInsertText(server))} disabled={disabled}>
          <Plus className="size-4" />
          插入
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {server.version && <Badge variant="secondary" className="text-[11px]">v{server.version}</Badge>}
        {server.status && (
          <Badge variant={server.status === 'active' ? 'secondary' : 'outline'} className="text-[11px]">
            {server.status}
          </Badge>
        )}
        {server.isLatest && <Badge variant="outline" className="text-[11px]">latest</Badge>}
      </div>

      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Command className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{server.installHint ?? '社区 MCP 安装提示'}</span>
        </div>
        {(server.repositoryUrl || server.websiteUrl) && (
          <a
            href={server.websiteUrl ?? server.repositoryUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            打开来源
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </article>
  )
}

function OpenSourceMcpCard({
  source,
  onInsert,
  onAttach,
  attached,
  attachedEnabled,
  attaching,
  canAttach,
  disabled,
}: {
  source: CuratedOpenSourceMcp
  onInsert: (snippet: string) => void
  onAttach: (source: CuratedOpenSourceMcp) => void
  attached: boolean
  attachedEnabled: boolean
  attaching: boolean
  canAttach: boolean
  disabled: boolean
}): React.ReactElement {
  const icon = source.id === 'craft-session-mcp'
    ? <Workflow className="size-4 shrink-0 text-primary" />
    : source.id === 'craft-agents-docs-mcp'
      ? <BookOpen className="size-4 shrink-0 text-primary" />
      : <Globe2 className="size-4 shrink-0 text-primary" />

  return (
    <article className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {icon}
            <h4 className="truncate text-sm font-semibold text-foreground">{source.title}</h4>
            <Badge variant="outline" className="text-[11px]">{source.origin}</Badge>
            <Badge variant="outline" className="text-[11px]">{formatMcpTransportLabel(source.transport)}</Badge>
            {attached && (
              <Badge variant={attachedEnabled ? 'secondary' : 'outline'} className="text-[11px]">
                {attachedEnabled ? '已接入' : '已写入'}
              </Badge>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{source.description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {source.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onInsert(buildOpenSourceMcpInsertText(source))} disabled={disabled}>
          <Plus className="size-4" />
          插入草稿
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => onAttach(source)}
          disabled={disabled || attaching || !canAttach}
        >
          <Plug className="size-4" />
          {attaching ? '正在接入' : attached ? '更新工作区' : '接入工作区'}
        </Button>
      </div>

      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Command className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{source.installHint}</span>
        </div>
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          打开源码
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    </article>
  )
}

function WorkspaceMcpCard({
  server,
  onInsert,
  disabled,
}: {
  server: WorkspaceCapabilities['mcpServers'][number]
  onInsert: (snippet: string) => void
  disabled: boolean
}): React.ReactElement {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Plug className="size-4 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-semibold text-foreground">{server.name}</h4>
            <Badge variant="outline" className="text-[11px]">{formatMcpTransportLabel(server.type)}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {server.enabled ? '当前已启用' : '当前已关闭'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onInsert(buildWorkspaceMcpInsertText(server.name, server.type, server.enabled))} disabled={disabled}>
          <Plus className="size-4" />
          插入
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={server.enabled ? 'secondary' : 'outline'} className="text-[11px]">
          {server.enabled ? '启用' : '关闭'}
        </Badge>
      </div>
    </article>
  )
}

function BuiltinMcpCard({
  server,
  onInsert,
  disabled,
}: {
  server: BuiltinMcpServerSummary
  onInsert: (snippet: string) => void
  disabled: boolean
}): React.ReactElement {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="size-4 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-semibold text-foreground">{server.displayName}</h4>
            <Badge variant="outline" className="text-[11px]">{server.category}</Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{server.description}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onInsert(buildBuiltinMcpInsertText(server))} disabled={disabled}>
          <Plus className="size-4" />
          插入
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={server.available ? 'secondary' : 'outline'} className="text-[11px]">
          {server.available ? '可用' : (server.availabilityReason ?? '不可用')}
        </Badge>
        <Badge variant="outline" className="text-[11px]">{server.tools.length} 个工具</Badge>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{formatBuiltinMcpTools(server)}</p>
    </article>
  )
}

function CliCommandCard({
  cli,
  command,
  onInsert,
  disabled,
}: {
  cli: RegisteredCLI
  command: RegisteredCLI['introspect']['commands'][number]
  onInsert: (snippet: string) => void
  disabled: boolean
}): React.ReactElement {
  const argSummary = command.args?.length
    ? command.args.map(formatConnectorArg).join(' · ')
    : '无额外参数'

  return (
    <article className="flex h-full flex-col rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Command className="size-4 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-semibold text-foreground">{formatConnectorCommandPath(command)}</h4>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px]',
                command.sideEffect === 'write' && 'border-rose-500/40 text-rose-600 dark:text-rose-300',
                command.sideEffect === 'read' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300',
              )}
            >
              {formatConnectorSideEffect(command.sideEffect)}
            </Badge>
            {command.dryRun && <Badge variant="outline" className="text-[11px]">试运行</Badge>}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{argSummary}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => onInsert(buildConnectorInsertText(cli, command))}
          disabled={disabled}
        >
          <Plus className="size-4" />
          插入
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-[11px]">{cli.name}</Badge>
        <Badge variant="outline" className="font-mono text-[11px]">{cli.version}</Badge>
      </div>
    </article>
  )
}

function LoadingState({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function EmptyState({
  text,
  children,
}: {
  text: string
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-background/30 px-4 py-5 text-sm text-muted-foreground">
      <p>{text}</p>
      {children}
    </div>
  )
}
