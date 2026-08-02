import type { BuiltinMcpServerSummary, McpServerEntry, McpTransportType, WorkspaceCapabilities } from '@proma/shared'
import type { CLIArgSpec, CLICommandSpec, CommunityMcpRegistryServerSummary, RegisteredCLI } from '@/lib/helios/types'
import type { CuratedOpenSourceMcp } from './open-source-mcp-catalog'

export function normalizeConnectorQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function formatConnectorSideEffect(sideEffect: string): string {
  switch (sideEffect) {
    case 'write':
      return '写入'
    case 'read':
      return '读取'
    case 'none':
    default:
      return '无副作用'
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
    command.dryRun ? '如果需要验证，可优先使用试运行。' : '按真实执行路径编排。',
  ].join('\n')
}

export function formatMcpTransportLabel(type: McpTransportType): string {
  switch (type) {
    case 'stdio':
      return '标准输入输出'
    case 'http':
      return '超文本传输'
    case 'sse':
      return '服务器推送'
    default:
      return type
  }
}

export function formatBuiltinMcpCategoryLabel(category: string): string {
  switch (category) {
    case 'collaboration':
      return '协作'
    case 'automation':
      return '自动化'
    case 'knowledge':
      return '知识'
    case 'developer':
      return '开发'
    case 'productivity':
      return '效率'
    default:
      return category
  }
}

export function formatCommunityTransportLabel(transport?: string): string {
  switch (transport) {
    case 'stdio':
      return '标准输入输出'
    case 'http':
      return '超文本传输'
    case 'sse':
      return '服务器推送'
    case 'streamable-http':
    case 'streamableHttp':
    case 'streamable_http':
      return '流式超文本传输'
    default:
      return transport ?? '未知'
  }
}

export function formatCommunityStatusLabel(status?: string): string {
  switch (status) {
    case 'active':
      return '可用'
    case 'deprecated':
      return '已废弃'
    case 'archived':
      return '已归档'
    case 'inactive':
      return '未启用'
    default:
      return status ?? '未知'
  }
}

export function formatBuiltinMcpTools(server: Pick<BuiltinMcpServerSummary, 'tools'>): string {
  if (server.tools.length === 0) return '无工具'
  return server.tools.map((tool) => tool.name).join(' · ')
}

export function buildBuiltinMcpInsertText(server: BuiltinMcpServerSummary): string {
  return [
    `请优先使用工作区平台连接器 \`${server.displayName}\`（${formatBuiltinMcpCategoryLabel(server.category)}）。`,
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
    `版本：${server.version ?? '最新'}；传输：${formatCommunityTransportLabel(server.transport)}。`,
    server.installHint ? `安装建议：${server.installHint}。` : '从社区 MCP 目录安装后再接入。',
    server.websiteUrl || server.repositoryUrl ? `来源：${server.websiteUrl ?? server.repositoryUrl}。` : '来源：社区 MCP 目录。',
  ].join('\n')
}

export function buildOpenSourceMcpInsertText(source: CuratedOpenSourceMcp): string {
  return [
    `当前工作流优先使用开源 MCP \`${source.title}\`。`,
  ].join('\n')
}

export interface CuratedOpenSourceMcpWorkspacePlan {
  name: string
  entry: McpServerEntry
  attachNote: string
}

export function getCuratedOpenSourceMcpWorkspaceName(source: CuratedOpenSourceMcp): string {
  switch (source.id) {
    case 'openwork-mcp':
      return 'openwork'
    case 'craft-agents-docs-mcp':
      return 'craft-docs'
    case 'craft-session-mcp':
      return 'craft-session'
    case 'github-mcp-server':
      return 'github'
    case 'filesystem-mcp-server':
      return 'filesystem'
    case 'git-mcp-server':
      return 'git'
    case 'sequential-thinking-mcp-server':
      return 'sequential-thinking'
    case 'time-mcp-server':
      return 'time'
    case 'fetch-mcp-server':
      return 'fetch'
    default:
      return source.id
  }
}

export function buildCuratedOpenSourceMcpWorkspacePlan(
  source: CuratedOpenSourceMcp,
  workspaceFilesPath?: string,
): CuratedOpenSourceMcpWorkspacePlan | null {
  switch (source.id) {
    case 'openwork-mcp':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'http',
          url: 'https://api.openworklabs.com/mcp/agent',
          enabled: true,
        },
        attachNote: '已写入 OpenWork 公开端点，启用后即可在工作流和智能体中使用。',
      }
    case 'craft-agents-docs-mcp':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'http',
          url: 'https://agents.craft.do/docs/mcp',
          enabled: true,
        },
        attachNote: '已写入 Craft 文档端点，启用后即可直接检索说明。',
      }
    case 'craft-session-mcp':
      return null
    case 'github-mcp-server':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'http',
          url: 'https://api.githubcopilot.com/mcp/',
          headers: {
            Authorization: 'Bearer <你的 GitHub 个人访问令牌>',
          },
          enabled: false,
        },
        attachNote: '已写入 GitHub 官方远程 MCP 模板，补全 GitHub 个人访问令牌后再启用。',
      }
    case 'filesystem-mcp-server':
      if (!workspaceFilesPath) return null
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', workspaceFilesPath],
          enabled: true,
        },
        attachNote: `已指向当前工作区目录：${workspaceFilesPath}。`,
      }
    case 'git-mcp-server':
      if (!workspaceFilesPath) return null
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-git', '--repository', workspaceFilesPath],
          enabled: true,
        },
        attachNote: `已指向当前工作区仓库：${workspaceFilesPath}。`,
      }
    case 'sequential-thinking-mcp-server':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          enabled: true,
        },
        attachNote: '已写入顺序思考服务器。',
      }
    case 'time-mcp-server':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-time'],
          enabled: true,
        },
        attachNote: '已写入时间服务器。',
      }
    case 'fetch-mcp-server':
      return {
        name: getCuratedOpenSourceMcpWorkspaceName(source),
        entry: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-fetch'],
          enabled: true,
        },
        attachNote: '已写入网页抓取服务器。',
      }
    default:
      return null
  }
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
    formatConnectorSideEffect(command.sideEffect),
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
    formatBuiltinMcpTools(server),
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
  const haystack = [
    server.name,
    server.type,
    server.enabled ? 'enabled' : 'disabled',
    server.enabled ? '已启用' : '已关闭',
  ].join(' ').toLowerCase()
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
    formatCommunityTransportLabel(server.transport),
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

export function matchesOpenSourceMcpQuery(source: CuratedOpenSourceMcp, query: string): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [
    source.id,
    source.title,
    source.description,
    source.origin,
    source.transport,
    formatMcpTransportLabel(source.transport),
    source.installHint,
    source.sourceUrl,
    source.repositoryUrl,
    ...(source.tags ?? []),
  ].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterOpenSourceMcpCatalog(
  connectors: CuratedOpenSourceMcp[],
  query: string,
): CuratedOpenSourceMcp[] {
  return connectors.filter((source) => matchesOpenSourceMcpQuery(source, query))
}
