export type CuratedOpenSourceMcpTransport = 'http' | 'stdio'

export interface CuratedOpenSourceMcp {
  id: string
  title: string
  description: string
  transport: CuratedOpenSourceMcpTransport
  installHint: string
  sourceUrl: string
  repositoryUrl: string
  tags: string[]
}

export const CURATED_OPEN_SOURCE_MCP_CATALOG: CuratedOpenSourceMcp[] = [
  {
    id: 'openwork-mcp',
    title: 'OpenWork MCP',
    description: '把 OpenWork 的 skills、plugins 和 MCP connections 接到任何兼容 agent。',
    transport: 'http',
    installHint: 'codex mcp add openwork --url https://api.openworklabs.com/mcp/agent',
    sourceUrl: 'https://github.com/different-ai/openwork',
    repositoryUrl: 'https://api.openworklabs.com/mcp/agent',
    tags: ['skills', 'plugins', 'Google Workspace', 'Microsoft 365'],
  },
  {
    id: 'craft-agents-docs-mcp',
    title: 'Craft Agents Docs MCP',
    description: '检索 Craft 的源配置、服务指南和连接器说明。',
    transport: 'http',
    installHint: 'https://agents.craft.do/docs/mcp',
    sourceUrl: 'https://github.com/craft-ai-agents/craft-agents-oss',
    repositoryUrl: 'https://agents.craft.do/docs/mcp',
    tags: ['docs', 'guides', 'search'],
  },
  {
    id: 'craft-session-mcp',
    title: 'Craft Session MCP Server',
    description: '提供 SubmitPlan、config_validate 等 session 级工具。',
    transport: 'stdio',
    installHint: 'cd craft-agents-oss && bun run packages/session-mcp-server/src/index.ts -- --session-id <会话ID> --workspace-root <工作区路径> --plans-folder <计划目录>',
    sourceUrl: 'https://github.com/craft-ai-agents/craft-agents-oss',
    repositoryUrl: 'https://github.com/craft-ai-agents/craft-agents-oss/tree/main/packages/session-mcp-server',
    tags: ['session tools', 'SubmitPlan', 'config_validate'],
  },
]
