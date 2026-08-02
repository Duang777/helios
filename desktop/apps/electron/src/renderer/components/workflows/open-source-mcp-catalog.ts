export type CuratedOpenSourceMcpTransport = 'http' | 'stdio'
export type CuratedOpenSourceMcpOrigin = '项目' | '官方'

export interface CuratedOpenSourceMcp {
  id: string
  title: string
  description: string
  origin: CuratedOpenSourceMcpOrigin
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
    origin: '项目',
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
    origin: '项目',
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
    origin: '项目',
    transport: 'stdio',
    installHint: 'cd craft-agents-oss && bun run packages/session-mcp-server/src/index.ts -- --session-id <会话ID> --workspace-root <工作区路径> --plans-folder <计划目录>',
    sourceUrl: 'https://github.com/craft-ai-agents/craft-agents-oss',
    repositoryUrl: 'https://github.com/craft-ai-agents/craft-agents-oss/tree/main/packages/session-mcp-server',
    tags: ['session tools', 'SubmitPlan', 'config_validate'],
  },
  {
    id: 'github-mcp-server',
    title: 'GitHub MCP Server',
    description: '官方 GitHub 连接器，覆盖仓库、议题、PR 和上下文工具。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'npx -y @modelcontextprotocol/server-github（需配置 GITHUB_PERSONAL_ACCESS_TOKEN）',
    sourceUrl: 'https://github.com/github/github-mcp-server',
    repositoryUrl: 'https://github.com/github/github-mcp-server/blob/main/README.md',
    tags: ['GitHub', 'repos', 'issues', 'pull requests'],
  },
  {
    id: 'filesystem-mcp-server',
    title: 'Filesystem MCP Server',
    description: '带访问控制的本地文件系统读写与目录操作。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/files',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    tags: ['filesystem', 'files', 'roots', 'search'],
  },
  {
    id: 'git-mcp-server',
    title: 'Git MCP Server',
    description: '读取、搜索并操作 Git 仓库，适合代码工作流接入。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-git --repository <仓库路径>',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    tags: ['git', 'repository', 'search', 'uvx'],
  },
  {
    id: 'sequential-thinking-mcp-server',
    title: 'Sequential Thinking MCP Server',
    description: '把复杂问题拆成可反复修正的逐步思考链。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    tags: ['reasoning', 'planning', 'analysis', 'steps'],
  },
  {
    id: 'time-mcp-server',
    title: 'Time MCP Server',
    description: '提供时区转换与当前时间查询。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-time',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    tags: ['time', 'timezone', 'clock'],
  },
  {
    id: 'fetch-mcp-server',
    title: 'Fetch MCP Server',
    description: '抓取网页并转成更适合模型读取的 Markdown。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-fetch',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    tags: ['fetch', 'web', 'markdown', 'http'],
  },
]
