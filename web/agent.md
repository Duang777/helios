# Web Agent Guide

## Purpose

The web app is the Helios operation console. It should open directly into the workflow compiler/runtime experience, not a marketing landing page.

## Current Status

- Building Vite React MVP.
- API base defaults to `http://localhost:8080/api`.
- UI references Hallmark/shadcn design discipline without copying code.

## Rules

- Prefer shadcn/Base UI components before creating custom primitives.
- When adding a new frontend component, run `pnpm ui:add <component>` from the repository root.
- The current Vite app uses Base UI via `@base-ui/react`; shared wrappers live in `web/src/components/ui/primitives.tsx`.
- Use `awesome-shadcn-ui` (`https://github.com/birobirobiro/awesome-shadcn-ui`) as the discovery index for shadcn ecosystem components, blocks, and patterns. Before using anything found there, return to the original project and confirm its license, dependencies, and maintenance status.
- Use `cult-ui` (`https://github.com/nolly-studio/cult-ui`) as a reference source for open-source motion and AI UI components that may be borrowed or migrated after confirming license, dependencies, and maintenance status.
- Keep interaction controls compact and explicit.
- Use lucide icons in icon buttons when available.
- Use stable dimensions for workflow nodes and panels.
- Avoid one-note purple/blue AI palettes.
- Do not add visible instructional copy about how the app works.
