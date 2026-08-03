# Helios Desktop

Helios Desktop is the Electron client for business chat, Workflow Studio, the MCP/Connector Center, and Agent workspaces. It connects to the local Helios API and turns natural-language business goals into auditable workflows that can be generated, validated, saved, and run.

[中文 README](./README.md)

## Capabilities

- **Business chat**: a natural-language entry point for business users, with workspace context and configured capabilities.
- **Workflow Studio**: generate workflow cards and canvas nodes from one business goal, then inspect steps, validation, source, run state, and generated files.
- **MCP/Connector Center**: manage workspace, platform, CLI, and open-source MCP entries from one place.
- **Agent workspaces**: manage project Skills, MCP servers, workspace files, and local runtime settings.
- **Local-first storage**: conversations, configuration, workspaces, and generated artifacts remain inspectable on the local machine.

## Development

```bash
cd desktop
bun install
bun run dev
```

Common verification commands:

```bash
cd desktop
bun test apps/electron/src/renderer/components/workflows/connector-palette-helpers.test.ts
bun run typecheck
bun run build:renderer
```

## Helios API Integration

The renderer should access Helios through `desktop/apps/electron/src/renderer/lib/helios/client.ts`. Workflow generation, validation, saving, and running should stay behind that client instead of scattering raw `fetch` calls through UI components.

For local development, start the backend first and then launch the desktop app:

```bash
go run ./backend/cmd/helios
cd desktop && bun run dev
```

## Layout

```text
desktop/
├── apps/electron/             # Electron main, preload, renderer
├── packages/                  # Shared packages and UI primitives
└── README.md                  # Desktop documentation
```

Some historical internal package names, protocol names, and local data paths are kept for compatibility with existing runtime code. User-facing product text and Workflow Studio behavior should use Helios naming.

## License

The desktop app is distributed under AGPL-3.0. See [LICENSE](./LICENSE) for the full terms and [UPSTREAM.md](./UPSTREAM.md) for third-party attribution.
