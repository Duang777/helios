# Agent Guide

## Product Direction

Build `Helios`, a Go-native AI Workflow Compiler. Do not describe the project as a Helios clone or port. Use `SKUFlow` only as an industry application shell that proves the generic workflow kernel in a new product development scenario.

## Current Plan

1. Establish project guidance, architecture notes, and reference boundaries.
2. Implement the Go workflow compiler/runtime API.
3. Build the React operation console.
4. Verify backend tests, frontend build, and local runtime.

## Coding Standards

- Prefer small, contract-first changes.
- Keep backend domain types in `backend/internal/domain`.
- Keep HTTP validation at API boundaries.
- Keep runtime behavior deterministic unless an explicit AI provider adapter is added.
- Use scoped agent context per node. Do not introduce global prompt state.
- For UI, build the tool surface directly. Avoid landing-page treatment.
- Prefer shadcn/Base UI components for frontend surfaces. When a new UI component is needed, run `pnpm ui:add <component>` from the repository root instead of hand-rolling a local replacement.
- When feedback says the frontend is ugly, treat it as a product-fit failure, not a palette issue: re-check the reference product, required workflows, information architecture, density, and visual polish before editing CSS. Avoid reading screenshots with `view_image` for this project because it can exhaust context; verify UI through DOM structure, computed styles, browser automation, and sparse screenshot metadata instead.

## Skills Used

- `api-and-interface-design` for REST and module contracts.
- `frontend-ui-engineering` for the operation console.
- `incremental-implementation` for thin implementation slices.
- `test-driven-development` for compiler/runtime behavior.
- `git-workflow-and-versioning` for change discipline.

## External References

- `Nutlope/hallmark`: MIT, used as product/design quality inspiration only.
- `birobirobiro/awesome-shadcn-ui`: frontend component reference index for shadcn ecosystem components, blocks, and patterns. Use it for discovery only, then go back to the original project to confirm license, dependencies, and maintenance status before reusing code.
- `nolly-studio/cult-ui`: frontend reference source for open-source motion and AI UI components that may be borrowed or migrated after verifying license, dependencies, and maintenance status.

Do not copy code from reference repositories into this project without adding attribution and confirming license compatibility.
