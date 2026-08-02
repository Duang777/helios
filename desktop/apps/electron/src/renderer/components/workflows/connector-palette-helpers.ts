import type { BuiltinMcpServerSummary, McpTransportType, WorkspaceCapabilities } from '@proma/shared'
import type { CLIArgSpec, CLICommandSpec, CommunityMcpRegistryServerSummary, RegisteredCLI } from '@/lib/helios/types'

export function normalizeConnectorQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function formatConnectorSideEffect(sideEffect: string): string {
  switch (sideEffect) {
    case 'write':
      return 'write'
    case 'read':
      return 'read'
    case 'none':
    default:
      return 'none'
  }
}

export function formatConnectorCommandPath(command: CLICommandSpec): string {
  return command.path.join(' ')
}

export function formatConnectorArg(arg: CLIArgSpec): string {
  const parts = [arg.name]
  if (arg.required) parts.push('必填')
  if (arg.enum && arg.enum.length > 0) {
    parts.push(`可选: ${arg.enum.join('|')}`)
  }
  if (arg.default !== undefined) {
    parts.push(`默认: ${String(arg.default)}`)
  }
  return parts.join(' · ')
}

export function buildConnectorInsertText(cli: RegisteredCLI, command: CLICommandSpec): string {
  const commandPath = formatConnectorCommandPath(command)
  const sideEffect = formatConnectorSideEffect(command.sideEffect)
  const argSummary = command.args && command.args.length > 0
    ? command.args.map(formatConnectorArg).join('；')
    : '无额外参数'

  return [
    `请优先使用连接器 \`${cli.name} ${commandPath}\`（${sideEffect}）。`,
    `参数：${argSummary}`,
    command.dryRun ? '如果需要验证，可优先使用 dry-run。' : '按真实执行路径编排。',
  ].join('\n')
}

export function formatMcpTransportLabel(type: McpTransportType): string {
  switch (type) {
    case 'stdio':
      return 'stdio'
    case 'http':
      return 'HTTP'
    case 'sse':
      return 'SSE'
    default:
      return type
  }
}

export function formatBuiltinMcpTools(server: Pick<BuiltinMcpServerSummary, 'tools'>): string {
  if (server.tools.length === 0) return '无工具'
  return server.tools.map((tool) => tool.name).join(' · ')
}

export function buildBuiltinMcpInsertText(server: BuiltinMcpServerSummary): string {
  return [
    `请优先使用工作区平台连接器 \`${server.displayName}\`（${server.category}）。`,
    `工具：${formatBuiltinMcpTools(server)}。`,
    server.availabilityReason ? `可用性提示：${server.availabilityReason}。` : '当前平台在工作区可用。',
  ].join('\n')
}

export function buildWorkspaceMcpInsertText(name: string, type: McpTransportType, enabled: boolean): string {
  return [
    `请优先使用工作区 MCP 连接器 \`${name}\`。`,
    `传输：${formatMcpTransportLabel(type)}；状态：${enabled ? '已启用' : '已关闭'}。`,
  ].join('\n')
}

export function buildCommunityMcpInsertText(server: CommunityMcpRegistryServerSummary): string {
  return [
    `请优先使用社区 MCP \`${server.title ?? server.name}\`（${server.name}）。`,
    `版本：${server.version ?? 'latest'}；传输：${server.transport ?? 'unknown'}。`,
    server.installHint ? `安装建议：${server.installHint}。` : '从 MCP Registry 安装后再接入。',
    server.websiteUrl || server.repositoryUrl ? `来源：${server.websiteUrl ?? server.repositoryUrl}。` : '来源：MCP Registry。',
  ].join('\n')
}

export function insertTextAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`
  const nextCursor = start + insertion.length
  return {
    value: nextValue,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  }
}

export function matchesConnectorQuery(
  cli: RegisteredCLI,
  command: CLICommandSpec,
  query: string,
): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [
    cli.name,
    cli.version,
    command.path.join(' '),
    command.sideEffect,
    ...(command.args ?? []).map((arg) => [
      arg.name,
      arg.type,
      ...(arg.enum ?? []),
      arg.default == null ? '' : String(arg.default),
    ].join(' ')),
  ].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterConnectorCatalog(connectors: RegisteredCLI[], query: string): RegisteredCLI[] {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return connectors
  return connectors.filter((cli) =>
    cli.introspect.commands.some((command) => matchesConnectorQuery(cli, command, normalized)),
  )
}

export function filterConnectorCommands(cli: RegisteredCLI, query: string): CLICommandSpec[] {
  return cli.introspect.commands.filter((command) => matchesConnectorQuery(cli, command, query))
}

export function countConnectorCommands(cli: RegisteredCLI): number {
  return cli.introspect.commands.length
}

export function matchesBuiltinMcpQuery(server: BuiltinMcpServerSummary, query: string): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [
    server.id,
    server.name,
    server.displayName,
    server.description,
    server.category,
    ...(server.tools ?? []).flatMap((tool) => [tool.name, tool.description]),
    server.availabilityReason ?? '',
  ].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterBuiltinMcpCatalog(connectors: BuiltinMcpServerSummary[], query: string): BuiltinMcpServerSummary[] {
  return connectors.filter((server) => matchesBuiltinMcpQuery(server, query))
}

export function matchesWorkspaceMcpQuery(
  server: WorkspaceCapabilities['mcpServers'][number],
  query: string,
): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [server.name, server.type, server.enabled ? 'enabled' : 'disabled'].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterWorkspaceMcpCatalog(
  connectors: WorkspaceCapabilities['mcpServers'],
  query: string,
): WorkspaceCapabilities['mcpServers'] {
  return connectors.filter((server) => matchesWorkspaceMcpQuery(server, query))
}

export function matchesCommunityMcpQuery(server: CommunityMcpRegistryServerSummary, query: string): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [
    server.name,
    server.title ?? '',
    server.description ?? '',
    server.version ?? '',
    server.transport ?? '',
    server.installHint ?? '',
    server.status ?? '',
    server.repositoryUrl ?? '',
    server.websiteUrl ?? '',
  ].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterCommunityMcpCatalog(
  connectors: CommunityMcpRegistryServerSummary[],
  query: string,
): CommunityMcpRegistryServerSummary[] {
  return connectors.filter((server) => matchesCommunityMcpQuery(server, query))
}
