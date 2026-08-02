import { describe, expect, test } from 'bun:test'
import type { BuiltinMcpServerSummary } from '@proma/shared'
import type { RegisteredCLI } from '@/lib/helios/types'
import {
  buildBuiltinMcpInsertText,
  buildCommunityMcpInsertText,
  buildConnectorInsertText,
  buildCuratedOpenSourceMcpWorkspacePlan,
  buildOpenSourceMcpInsertText,
  buildWorkspaceMcpInsertText,
  countConnectorCommands,
  filterConnectorCommands,
  filterBuiltinMcpCatalog,
  filterCommunityMcpCatalog,
  filterConnectorCatalog,
  filterOpenSourceMcpCatalog,
  filterWorkspaceMcpCatalog,
  formatConnectorArg,
  formatConnectorCommandPath,
  formatConnectorSideEffect,
  formatCommunityStatusLabel,
  formatMcpTransportLabel,
  insertTextAtSelection,
  matchesBuiltinMcpQuery,
  matchesCommunityMcpQuery,
  matchesOpenSourceMcpQuery,
  matchesWorkspaceMcpQuery,
  normalizeConnectorQuery,
} from './connector-palette-helpers'
import { CURATED_OPEN_SOURCE_MCP_CATALOG } from './open-source-mcp-catalog'

const inventoryCli: RegisteredCLI = {
  name: 'demo-inventory',
  version: '0.1.0',
  path: '/tmp/demo-inventory',
  introspect: {
    name: 'demo-inventory',
    version: '0.1.0',
    commands: [
      {
        path: ['items', 'create'],
        sideEffect: 'write',
        dryRun: true,
        args: [
          { name: '--from-json', type: 'json', required: true },
          { name: '--output', type: 'string', enum: ['json'], default: 'json' },
        ],
      },
      {
        path: ['items', 'list'],
        sideEffect: 'read',
      },
    ],
  },
}

const builtinMcp: BuiltinMcpServerSummary = {
  id: 'feishu',
  name: 'feishu',
  displayName: '飞书',
  description: '飞书文档、表格与消息',
  category: 'collaboration',
  enabled: true,
  available: true,
  tools: [
    { name: 'docs_read', description: '读取文档', readOnly: true },
    { name: 'docs_write', description: '写入文档' },
  ],
}

const communityMcp = {
  name: 'ac.inference.sh/mcp',
  title: 'inference.sh',
  description: 'run any ai model. compose agents, stack knowledge, connect tools.',
  version: '2.0.1',
  transport: 'streamable-http',
  installHint: 'streamable-http · https://api.inference.sh/mcp',
  websiteUrl: 'https://registry.modelcontextprotocol.io',
  status: 'active',
  isLatest: true,
}

describe('connector palette helpers', () => {
  test('normalizes connector queries and formats commands', () => {
    expect(normalizeConnectorQuery('  GitHub  MCP ')).toBe('github  mcp')
    expect(formatConnectorCommandPath(inventoryCli.introspect.commands[0]!)).toBe('items create')
    expect(formatConnectorSideEffect('write')).toBe('写入')
    expect(formatMcpTransportLabel('stdio')).toBe('标准输入输出')
  })

  test('formats connector args for display', () => {
    expect(formatConnectorArg(inventoryCli.introspect.commands[0]!.args![0]!)).toBe('--from-json · 必填')
    expect(formatConnectorArg(inventoryCli.introspect.commands[0]!.args![1]!)).toBe('--output · 可选: json · 默认: json')
  })

  test('builds insert text with command summary and dry-run hint', () => {
    expect(buildConnectorInsertText(inventoryCli, inventoryCli.introspect.commands[0]!)).toContain('请优先使用连接器 `demo-inventory items create`（写入）。')
    expect(buildConnectorInsertText(inventoryCli, inventoryCli.introspect.commands[0]!)).toContain('如果需要验证，可优先使用试运行。')
  })

  test('formats and filters builtin MCP platforms', () => {
    expect(formatMcpTransportLabel('http')).toBe('超文本传输')
    expect(buildBuiltinMcpInsertText(builtinMcp)).toContain('请优先使用工作区平台连接器 `飞书`（协作）。')
    expect(buildBuiltinMcpInsertText(builtinMcp)).toContain('工具：docs_read · docs_write。')
    expect(matchesBuiltinMcpQuery(builtinMcp, '飞书 docs_write')).toBe(true)
    expect(filterBuiltinMcpCatalog([builtinMcp], 'docs_read')).toHaveLength(1)
  })

  test('formats and filters workspace MCP entries', () => {
    expect(buildWorkspaceMcpInsertText('nowledge-mem', 'http', true)).toContain('传输：超文本传输；状态：已启用。')
    expect(matchesWorkspaceMcpQuery({ name: 'nowledge-mem', enabled: true, type: 'http' }, 'nowledge enabled')).toBe(true)
    expect(filterWorkspaceMcpCatalog([{ name: 'nowledge-mem', enabled: true, type: 'http' }], 'sse')).toHaveLength(0)
  })

  test('formats and filters community MCP registry entries', () => {
    expect(buildCommunityMcpInsertText(communityMcp)).toContain('请优先使用社区 MCP `inference.sh`（ac.inference.sh/mcp）。')
    expect(formatCommunityStatusLabel(communityMcp.status)).toBe('可用')
    expect(matchesCommunityMcpQuery(communityMcp, 'inference streamable')).toBe(true)
    expect(filterCommunityMcpCatalog([communityMcp], 'compose tools')).toHaveLength(1)
  })

  test('formats and filters curated open-source MCP entries', () => {
    const openWork = CURATED_OPEN_SOURCE_MCP_CATALOG[0]
    expect(openWork).toBeDefined()
    expect(openWork!.origin).toBe('项目')
    expect(buildOpenSourceMcpInsertText(openWork!)).toContain('当前工作流优先使用开源 MCP `OpenWork 开源 MCP`。')
    expect(matchesOpenSourceMcpQuery(openWork!, 'openwork 技能')).toBe(true)
    expect(filterOpenSourceMcpCatalog(CURATED_OPEN_SOURCE_MCP_CATALOG, '会话 工具')).toHaveLength(1)
    expect(filterOpenSourceMcpCatalog(CURATED_OPEN_SOURCE_MCP_CATALOG, '拉取请求')).toHaveLength(1)
    expect(filterOpenSourceMcpCatalog(CURATED_OPEN_SOURCE_MCP_CATALOG, '官方').length).toBeGreaterThan(0)
    expect(CURATED_OPEN_SOURCE_MCP_CATALOG.length).toBeGreaterThan(3)
  })

  test('builds curated workspace attach plans', () => {
    const github = CURATED_OPEN_SOURCE_MCP_CATALOG.find((item) => item.id === 'github-mcp-server')
    const filesystem = CURATED_OPEN_SOURCE_MCP_CATALOG.find((item) => item.id === 'filesystem-mcp-server')
    const flowwink = CURATED_OPEN_SOURCE_MCP_CATALOG.find((item) => item.id === 'flowwink-mcp-platform')
    expect(github).toBeDefined()
    expect(filesystem).toBeDefined()
    expect(flowwink).toBeDefined()

    const githubPlan = buildCuratedOpenSourceMcpWorkspacePlan(github!)
    const filesystemPlan = buildCuratedOpenSourceMcpWorkspacePlan(filesystem!, '/tmp/helios-workspace')
    const flowwinkPlan = buildCuratedOpenSourceMcpWorkspacePlan(flowwink!)

    expect(githubPlan?.name).toBe('github')
    expect(githubPlan?.entry.type).toBe('http')
    expect(githubPlan?.entry.enabled).toBe(false)
    expect(githubPlan?.entry.headers?.Authorization).toContain('GitHub 个人访问令牌')
    expect(filesystemPlan?.name).toBe('filesystem')
    expect(filesystemPlan?.entry.type).toBe('stdio')
    expect(filesystemPlan?.entry.enabled).toBe(true)
    expect(filesystemPlan?.entry.args).toContain('/tmp/helios-workspace')
    expect(flowwinkPlan?.name).toBe('flowwink')
    expect(flowwinkPlan?.entry.type).toBe('http')
    expect(flowwinkPlan?.entry.enabled).toBe(false)
    expect(flowwinkPlan?.entry.url).toContain('mode=dispatch')
    expect(flowwinkPlan?.entry.url).toContain('groups=sales,operations')
    expect(flowwinkPlan?.entry.headers?.Authorization).toContain('FlowWink MCP 访问令牌')
  })

  test('filters catalog by query tokens', () => {
    const filtered = filterConnectorCatalog([inventoryCli], 'items create write')
    const empty = filterConnectorCatalog([inventoryCli], 'github')
    const commands = filterConnectorCommands(inventoryCli, 'items list')

    expect(filtered).toHaveLength(1)
    expect(countConnectorCommands(filtered[0]!)).toBe(2)
    expect(empty).toHaveLength(0)
    expect(commands).toHaveLength(1)
    expect(commands[0]!.path.join(' ')).toBe('items list')
  })

  test('inserts snippet at the current selection', () => {
    expect(insertTextAtSelection('abc', 1, 2, 'XYZ')).toEqual({
      value: 'aXYZc',
      selectionStart: 4,
      selectionEnd: 4,
    })
    expect(insertTextAtSelection('abc', 99, 99, 'X')).toEqual({
      value: 'abcX',
      selectionStart: 4,
      selectionEnd: 4,
    })
  })
})
