# Helios

Helios is a Go-native AI Workflow Compiler for business operations. It turns a natural-language business goal into an executable workflow, scoped agent roles, runtime adapter contracts, generated app surfaces, evidence records, and an auditable run history.

The project is a general-purpose workflow kernel first. `SKUFlow` is the included industry scenario shell that applies the kernel to MINISO-style high-volume new product development.

## Positioning

Helios is inspired by the broader category of AI automation platforms, but it is not a Go port of any existing product. The implementation focuses on a lightweight enterprise runtime:

- Single-binary Go deployment for private environments.
- A small DAG executor built with plain Go concurrency primitives.
- Contract-first REST APIs for workflow compilation and runs.
- Role-scoped agent tasks instead of one global chat context.
- Runtime adapter boundaries for Codex Runtime, Claude, local tools, browser automation, MCP tools, approval gates, and evidence storage.
- Evidence ledger and run audit as first-class product surfaces.
- Template-driven mini apps for forms, approvals, reports, and dashboards.

## MVP Scope

- Compile one chat-style business request into workflow JSON.
- Persist workflow runs in memory for local demo use.
- Execute deterministic MVP node types: `llm_task`, `form`, `approval`, `human_task`, `report`, and `dashboard`.
- Show the Helios product loop in Chinese: chat builder, rendered node canvas, generated app preview, scoped agent panel, runtime adapter table, metrics, evidence ledger, and report summary.
- Ship a SKUFlow sample for new product development decisions.

The MVP runtime is deterministic and does not pretend to call external model providers without configured adapters. The compiled workflow explicitly marks adapter contracts such as `codex_runtime`, `claude`, `local_tools`, `human_gate`, and `audit_store` so real providers can be connected without changing the public API shape.

## Repository Layout

```text
backend/  Go workflow compiler, runtime, API, tests
web/      Vite React operation console
docs/     Product notes, architecture, and reference records
```

## Local Development

Backend:

```bash
cd backend
go test ./...
go run ./cmd/helios
```

Frontend:

```bash
cd web
npm install
npm run dev
```

By default, the frontend calls `http://localhost:8080/api`.
