# Helios 桌面端

Helios 桌面端是业务对话、Workflow Studio、MCP/Connector 中心和 Agent 工作区的 Electron 客户端。它连接本机 Helios API，把自然语言业务目标生成、校验、保存和运行为可审计工作流。

[English README](./README.en.md)

## 主要能力

- **业务对话**：面向业务人员的自然语言入口，支持引用上下文、选择工作空间和调用已配置能力。
- **Workflow Studio**：把一句业务目标生成工作流卡片和画布节点，支持查看步骤、校验结果、源码、运行状态和文件夹。
- **MCP/Connector 中心**：集中管理工作区、平台、CLI 和开源 MCP 能力，插入后可进入配置与使用闭环。
- **Agent 工作区**：按项目管理 Skills、MCP Server、工作区文件和本地运行配置。
- **本地优先**：会话、配置、工作区与运行制品保存在本机文件中，便于审计、备份和排查。

## 本地开发

```bash
cd desktop
bun install
bun run dev
```

常用验证命令：

```bash
cd desktop
bun test apps/electron/src/renderer/components/workflows/connector-palette-helpers.test.ts
bun run typecheck
bun run build:renderer
```

## 与 Helios 后端联调

桌面端默认通过 `desktop/apps/electron/src/renderer/lib/helios/client.ts` 访问 Helios API。Workflow Studio 的生成、校验、保存和运行都应走统一 client，不在 renderer 中散落直接 `fetch`。

开发时通常先启动后端，再启动桌面端：

```bash
go run ./backend/cmd/helios
cd desktop && bun run dev
```

## 目录提示

```text
desktop/
├── apps/electron/             # Electron main、preload、renderer
├── packages/                  # 共享包与 UI 基础能力
└── README.md                  # 桌面端说明
```

当前桌面端仍保留部分历史内部包名、协议名和本地配置目录，用于兼容已有运行路径。品牌文案、业务入口和 Workflow Studio 体验以 Helios 为准。

## 开源协议

桌面端遵循 AGPL-3.0。完整条款见 [LICENSE](./LICENSE)，第三方来源和归属说明见 [UPSTREAM.md](./UPSTREAM.md)。
