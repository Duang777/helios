import * as React from 'react'
import { AlertCircle, Loader2, Plus, Search, Workflow } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { listCLIs } from '@/lib/helios/client'
import type { RegisteredCLI } from '@/lib/helios/types'
import {
  buildConnectorInsertText,
  countConnectorCommands,
  filterConnectorCatalog,
  formatConnectorArg,
  formatConnectorCommandPath,
  matchesConnectorQuery,
} from './connector-palette-helpers'

interface ConnectorPaletteProps {
  onInsert: (snippet: string) => void
  disabled?: boolean
}

export function ConnectorPalette({ onInsert, disabled = false }: ConnectorPaletteProps): React.ReactElement {
  const [query, setQuery] = React.useState('')
  const [connectors, setConnectors] = React.useState<RegisteredCLI[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void listCLIs()
      .then((items) => {
        if (!active) return
        setConnectors(items.slice().sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch((err: unknown) => {
        if (!active) return
        setConnectors([])
        setError(err instanceof Error ? err.message : '加载 CLI 连接器失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const visibleConnectors = React.useMemo(() => filterConnectorCatalog(connectors, query), [connectors, query])
  const totalCommands = React.useMemo(
    () => connectors.reduce((sum, cli) => sum + countConnectorCommands(cli), 0),
    [connectors],
  )

  const handleInsert = React.useCallback((cli: RegisteredCLI, commandIndex: number) => {
    const command = cli.introspect.commands[commandIndex]
    if (!command) return
    onInsert(buildConnectorInsertText(cli, command))
  }, [onInsert])

  return (
    <section className="flex max-h-[360px] flex-col rounded-md border border-border/60 bg-background/45">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <h3 className="truncate text-sm font-medium">Connector Registry</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {connectors.length} 个连接器，{totalCommands} 个命令，直接插入到草稿里。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[11px]">/api/v1/clis</Badge>
      </div>

      <div className="border-b border-border/60 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索连接器、命令或参数"
            className="h-9 pl-9"
            disabled={disabled}
          />
        </div>
      </div>

      {error && (
        <div className="border-b border-border/60 px-4 py-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>连接器加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载可用连接器...
            </div>
          ) : visibleConnectors.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
              没有匹配的连接器。可以先切到 Agent 技能里注册 MCP，或者在后端注册 CLI。
            </div>
          ) : (
            visibleConnectors.map((cli) => {
              const visibleCommands = cli.introspect.commands.filter((command) => matchesConnectorQuery(cli, command, query))
              return (
                <article key={`${cli.name}-${cli.version}`} className="rounded-md border border-border/60 bg-background/60 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-medium">{cli.name}</h4>
                        <Badge variant="outline" className="font-mono text-[11px]">{cli.version}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{cli.path}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{visibleCommands.length}/{countConnectorCommands(cli)}</Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    {visibleCommands.map((command, commandIndex) => {
                      const originalIndex = cli.introspect.commands.findIndex((item) => item.path.join(' ') === command.path.join(' '))
                      const argSummary = command.args?.length
                        ? command.args.map(formatConnectorArg).join(' · ')
                        : '无额外参数'

                      return (
                        <div key={`${cli.name}-${formatConnectorCommandPath(command)}`} className="rounded-sm border border-border/60 bg-background/80 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="truncate font-mono text-xs text-foreground">{formatConnectorCommandPath(command)}</code>
                                <Badge variant="outline" className={cn(
                                  'text-[11px]',
                                  command.sideEffect === 'write' && 'border-rose-500/40 text-rose-600 dark:text-rose-300',
                                  command.sideEffect === 'read' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300',
                                )}>
                                  {command.sideEffect}
                                </Badge>
                                {command.dryRun && <Badge variant="outline" className="text-[11px]">dry-run</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{argSummary}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => handleInsert(cli, originalIndex >= 0 ? originalIndex : commandIndex)}
                              disabled={disabled}
                            >
                              <Plus className="size-4" />
                              插入
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
