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
    title: 'OpenWork 开源 MCP',
    description: '把 OpenWork 的技能、插件和 MCP 连接接到任何兼容的智能体。',
    origin: '项目',
    transport: 'http',
    installHint: 'codex mcp add openwork --url https://api.openworklabs.com/mcp/agent',
    sourceUrl: 'https://github.com/different-ai/openwork',
    repositoryUrl: 'https://api.openworklabs.com/mcp/agent',
    tags: ['技能', '插件', '谷歌工作区', '微软 365'],
  },
  {
    id: 'craft-agents-docs-mcp',
    title: 'Craft 文档 MCP',
    description: '检索 Craft 的源配置、服务指南和连接器说明。',
    origin: '项目',
    transport: 'http',
    installHint: 'https://agents.craft.do/docs/mcp',
    sourceUrl: 'https://github.com/craft-ai-agents/craft-agents-oss',
    repositoryUrl: 'https://agents.craft.do/docs/mcp',
    tags: ['文档', '指南', '搜索'],
  },
  {
    id: 'craft-session-mcp',
    title: 'Craft 会话 MCP 服务器',
    description: '提供 SubmitPlan、config_validate 等会话级工具。',
    origin: '项目',
    transport: 'stdio',
    installHint: '在 craft-agents-oss 仓库内运行：bun run packages/session-mcp-server/src/index.ts -- --session-id <会话ID> --workspace-root <工作区路径> --plans-folder <计划目录>',
    sourceUrl: 'https://github.com/craft-ai-agents/craft-agents-oss',
    repositoryUrl: 'https://github.com/craft-ai-agents/craft-agents-oss/tree/main/packages/session-mcp-server',
    tags: ['会话工具', '计划提交', '配置校验'],
  },
  {
    id: 'github-mcp-server',
    title: 'GitHub MCP 服务器',
    description: '官方 GitHub 连接器，覆盖仓库、议题、拉取请求和上下文工具。',
    origin: '官方',
    transport: 'http',
    installHint: '连接到 GitHub 官方远程 MCP 端点，并在工作区头信息里填写 GitHub 个人访问令牌。',
    sourceUrl: 'https://github.com/github/github-mcp-server',
    repositoryUrl: 'https://github.com/github/github-mcp-server',
    tags: ['仓库', '议题', '拉取请求', '上下文'],
  },
  {
    id: 'filesystem-mcp-server',
    title: '文件系统 MCP 服务器',
    description: '带访问控制的本地文件系统读写与目录操作。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'npx -y @modelcontextprotocol/server-filesystem <允许访问的目录>',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    tags: ['文件系统', '文件', '根目录', '搜索'],
  },
  {
    id: 'git-mcp-server',
    title: 'Git 仓库 MCP 服务器',
    description: '读取、搜索并操作 Git 仓库，适合代码工作流接入。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-git --repository <仓库路径>',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    tags: ['Git 仓库', '仓库', '搜索', 'Python 运行器'],
  },
  {
    id: 'sequential-thinking-mcp-server',
    title: '顺序思考 MCP 服务器',
    description: '把复杂问题拆成可反复修正的逐步思考链。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    tags: ['推理', '规划', '分析', '步骤'],
  },
  {
    id: 'time-mcp-server',
    title: '时间 MCP 服务器',
    description: '提供时区转换与当前时间查询。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-time',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    tags: ['时间', '时区', '时钟'],
  },
  {
    id: 'fetch-mcp-server',
    title: '网页抓取 MCP 服务器',
    description: '抓取网页并转成更适合模型读取的 Markdown。',
    origin: '官方',
    transport: 'stdio',
    installHint: 'uvx mcp-server-fetch',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    repositoryUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    tags: ['抓取', '网页', 'Markdown 文档', '超文本传输'],
  },
]
