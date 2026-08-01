# Helios Desktop Workflow Studio Tasks

## Task 1: Lock Desktop Studio Contract

**Description:** Define the desktop-facing compile result and workflow draft contract so backend, renderer, and future agents agree on one shape.

**Acceptance criteria:**
- [ ] Compile response includes `ir`, `yaml`, `validation`, `warnings`, and `repairAttempts`.
- [ ] Desktop types in `lib/helios/types.ts` match backend JSON exactly.
- [ ] Existing `POST /compile` callers keep working or have a compatibility shim.

**Verification:**
- [ ] `cd backend && go test ./internal/httpapi ./internal/compile`
- [ ] `cd desktop && bun run typecheck`

**Dependencies:** None

**Files likely touched:**
- `backend/internal/compile/`
- `backend/internal/httpapi/server.go`
- `desktop/apps/electron/src/renderer/lib/helios/types.ts`
- `desktop/apps/electron/src/renderer/lib/helios/client.ts`

**Estimated scope:** M

## Task 2: Add Schema-Grounded Compiler Rules

**Description:** Port the Kestra-style generation discipline into Helios prompts and validation: allowed step types, registry-derived tools, side-effect flags, approvals, and no invented properties.

**Acceptance criteria:**
- [ ] Compiler prompt receives Helios workflow schema and CLI/tool registry summary.
- [ ] Invalid step type/property fails validation before save/run.
- [ ] Repair loop includes previous YAML plus validation errors, capped at 3 attempts.

**Verification:**
- [ ] `cd backend && go test ./internal/compile ./internal/runtime`
- [ ] `./scripts/smoke-desktop-nl-compile.sh`

**Dependencies:** Task 1

**Files likely touched:**
- `backend/internal/compile/`
- `contracts/`
- `scripts/smoke-desktop-nl-compile.sh`

**Estimated scope:** M

## Task 3: Build Desktop Compiler Workbench View

**Description:** Add a real desktop view for natural-language workflow drafting with prompt input, YAML preview, validation panel, repair action, save, and run.

**Acceptance criteria:**
- [ ] Left sidebar or main nav exposes Workflow Studio.
- [ ] User can generate from intent and see YAML/validation without leaving desktop.
- [ ] User can save and run a validated draft via existing Helios API.

**Verification:**
- [ ] `cd desktop && bun run typecheck`
- [ ] `cd desktop && bun run build:renderer`
- [ ] Manual desktop run with Helios API on localhost.

**Dependencies:** Task 1

**Files likely touched:**
- `desktop/apps/electron/src/renderer/components/workflows/`
- `desktop/apps/electron/src/renderer/atoms/`
- `desktop/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- `desktop/apps/electron/src/renderer/lib/helios/`

**Estimated scope:** M

## Task 4: Add Workflow Graph Preview

**Description:** Use a reusable graph library, preferably MIT `@xyflow/react`, to render workflow steps, dependencies, approvals, and run status.

**Acceptance criteria:**
- [ ] Valid YAML renders a stable graph with step nodes and edges.
- [ ] Approval and failed states are visually distinct.
- [ ] Preview is read-only in v1; editing stays in YAML/compiler panel.

**Verification:**
- [ ] `cd desktop && bun run typecheck`
- [ ] `cd desktop && bun run build:renderer`
- [ ] Browser/Electron screenshot check once dev server is running.

**Dependencies:** Task 3

**Files likely touched:**
- `desktop/package.json`
- `desktop/apps/electron/package.json`
- `desktop/apps/electron/src/renderer/components/workflows/WorkflowGraph.tsx`

**Estimated scope:** M

## Task 5: Add Artifact Folder Draft Import/Export

**Description:** Let desktop create and open Output-style workflow folders containing YAML, intent, manifest, fixtures, and later TS source.

**Acceptance criteria:**
- [ ] Desktop can import a workflow folder and show parsed workflow/validation.
- [ ] Desktop can export current draft to `workflows/<id>/`.
- [ ] Export records `INTENT.md` and `manifest.json`.

**Verification:**
- [ ] `./scripts/smoke-workflow-folder.sh`
- [ ] `cd desktop && bun run typecheck`

**Dependencies:** Task 3

**Files likely touched:**
- `backend/internal/workflowdir/`
- `desktop/apps/electron/src/main/ipc.ts`
- `desktop/apps/electron/src/preload/index.ts`
- `desktop/apps/electron/src/renderer/components/workflows/`

**Estimated scope:** M

## Task 6: Add TS Workflow Authoring Package

**Description:** Create a small deterministic TypeScript DSL package that compiles declarations to Helios YAML. Do not execute generated TS as a runtime step.

**Acceptance criteria:**
- [ ] `workflow({ id }).param(...).step(...).approval(...)` or equivalent compiles to current YAML.
- [ ] Package has tests for YAML output and invalid definitions.
- [ ] Desktop can display generated TS for a workflow draft.

**Verification:**
- [ ] `cd desktop && bun test packages/workflow-ts`
- [ ] `cd desktop && bun run typecheck`

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `desktop/packages/workflow-ts/`
- `desktop/apps/electron/src/renderer/components/workflows/`
- `workflows/demo.folder-smoke/`

**Estimated scope:** M

## Task 7: Connector Registry UX

**Description:** Surface available CLI/tools as reusable desktop building blocks and feed the same registry into compiler prompts.

**Acceptance criteria:**
- [ ] Desktop lists available step types/connectors with parameters and side-effect markers.
- [ ] Compiler generated workflow only references listed connectors.
- [ ] User can insert a connector into prompt/draft from the UI.

**Verification:**
- [ ] `cd backend && go test ./internal/registry ./internal/httpapi`
- [ ] `cd desktop && bun run typecheck`

**Dependencies:** Task 2, Task 3

**Files likely touched:**
- `backend/internal/registry/`
- `backend/internal/httpapi/server.go`
- `desktop/apps/electron/src/renderer/components/workflows/ConnectorPalette.tsx`

**Estimated scope:** M

## Task 8: Desktop Run and Evidence Panel

**Description:** Bring run timeline, approval actions, step output, and evidence links into Workflow Studio instead of only chat cards.

**Acceptance criteria:**
- [ ] Run panel polls or subscribes to run status.
- [ ] Approval steps can be approved/rejected from the panel.
- [ ] Evidence files are visible/openable from desktop.

**Verification:**
- [ ] `./scripts/smoke-desktop-helios-api.sh`
- [ ] `cd desktop && bun run typecheck`
- [ ] Manual run through WAITING_APPROVAL to COMPLETED.

**Dependencies:** Task 3

**Files likely touched:**
- `desktop/apps/electron/src/renderer/components/workflows/RunPanel.tsx`
- `desktop/apps/electron/src/renderer/lib/helios/client.ts`
- `desktop/apps/electron/src/main/ipc.ts`

**Estimated scope:** M

## Checkpoint: First Usable Desktop Studio

- [ ] Tasks 1-3 complete.
- [ ] User can type intent, see generated YAML, validate, save, run.
- [ ] `cd backend && go test ./...`
- [ ] `cd desktop && bun run typecheck`
- [ ] `./scripts/smoke-desktop-nl-compile.sh`

## Checkpoint: Visual Workflow Studio

- [ ] Tasks 4-5 complete.
- [ ] User can preview graph and import/export workflow folders.
- [ ] `cd desktop && bun run build:renderer`
- [ ] `./scripts/smoke-workflow-folder.sh`

## Checkpoint: Reusable Authoring Layer

- [ ] Tasks 6-8 complete.
- [ ] TS DSL, connector palette, run/evidence panel are usable from desktop.
- [ ] `cd backend && go test ./...`
- [ ] `cd desktop && bun run typecheck`
- [ ] `./scripts/smoke-hatchet-scheduler.sh`
