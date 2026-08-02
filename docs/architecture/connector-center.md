# Connector Center

Date: 2026-08-02
Status: Active

## What changed

Workflow Studio now uses a dialog-first connector surface:

1. A compact `MCP 中心` button in the intent header.
2. An expandable MCP center dialog for browsing, inserting, and attaching connectors.

The launcher is intentionally just a small tool button. It should not become a first-screen card, a nested panel, or a second browse surface inside the workflow workspace.

The dialog now surfaces a dedicated open-source layer before the broader community registry, so the first thing a business user sees is a small set of directly usable, well-known MCP entry points rather than a giant generic catalog.
All visible labels in this surface should stay Chinese, including the transport badges, tab labels, attach-state markers, status badges, and insert actions shown on curated open-source cards.

## Data sources

The connector center currently combines three live Helios-backed sources:

- Local CLI registry from the Helios desktop backend.
- Workspace MCP and built-in platform capabilities from the current project.
- Community MCP Registry results from the official MCP Registry, proxied by Helios at `GET /api/v1/mcp-registry/servers`.

It also includes a curated open-source MCP layer in the renderer, seeded from directly installable upstream packages and public project endpoints:

- [different-ai/openwork](https://github.com/different-ai/openwork) via the public OpenWork MCP endpoint.
- [craft-ai-agents/craft-agents-oss](https://github.com/craft-ai-agents/craft-agents-oss) via the published Craft docs and session MCP entry points.
- [github/github-mcp-server](https://github.com/github/github-mcp-server) via the official GitHub MCP server package.
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) via the filesystem, git, sequential-thinking, time, and fetch reference servers.

These curated entries are not just descriptive cards. The workflow palette can upsert a selected entry into the current Helios workspace MCP config, and the main-process agent runtime already consumes that workspace `mcp.json` when it builds MCP server injection for sessions.

The insert action is intentionally lightweight: it writes a short intent hint such as “当前工作流优先使用开源 MCP …”, while the real attach action writes the usable MCP entry into the workspace. Long install commands, source URLs, and capability descriptions stay inside the dialog card instead of flooding the intent editor.

## What was borrowed

The UI direction was informed by the layout patterns in:

- [craft-ai-agents/craft-agents-oss](https://github.com/craft-ai-agents/craft-agents-oss)
- [different-ai/openwork](https://github.com/different-ai/openwork)

Those projects were used as interaction references and source material. We are reusing their public MCP entry points and command shapes, but not importing their desktop apps wholesale.

## What was actually integrated

The current implementation uses Helios-owned code and runtime data paths:

- `desktop/apps/electron/src/renderer/components/workflows/ConnectorPalette.tsx`
- `desktop/apps/electron/src/renderer/components/workflows/ConnectorRegistryDialog.tsx`
- `desktop/apps/electron/src/renderer/components/workflows/connector-palette-helpers.ts`
- `desktop/apps/electron/src/main/lib/agent-workspace-manager.ts`
- `desktop/apps/electron/src/renderer/lib/helios/client.ts`
- `backend/internal/httpapi/registry_mcp.go`

So the registry is real, the UI is Helios-native, and the open-source MCP section is intentionally limited to public, reproducible entry points rather than ad hoc prose.

## Layout rules

- Keep the launcher compact.
- Keep the launcher in the intent header, not as a card in the first screen.
- Use the dialog for browsing, insertion, and workspace attachment.
- Put open-source MCPs first so the panel feels like a curated entry point rather than a dump.
- Use small counts and badges for source state.
- Distinguish already-written templates from already-enabled MCPs in the curated open-source cards.
- Avoid nested summary cards at the top of the workflow column.
- Prefer card grids inside the expandable dialog, not in the launcher.
- Never insert multi-line installation drafts into the intent editor from a curated MCP card.

## Follow-up

If the launcher or dialog starts feeling heavy again, shrink the launcher first and keep the dialog for detailed browsing.
