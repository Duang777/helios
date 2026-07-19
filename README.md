<p align="center">
  <img src="docs/assets/helios-logo.png" alt="Helios logo" width="340" />
</p>

<h1 align="center">Helios</h1>

<p align="center">
  <strong>一句话，把企业数据编译成可追溯的 AI 工作流。</strong>
</p>

<p align="center">
  <a href="https://duang777.github.io/helios/">在线展示</a>
  ·
  <a href="https://duang777.github.io/helios/console/">控制台预览</a>
  ·
  <a href="docs/architecture.md">架构说明</a>
</p>

<p align="center">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.26-111820?labelColor=c9432f" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-7-111820?labelColor=b9d5dc" />
  <img alt="React" src="https://img.shields.io/badge/React-19-111820?labelColor=2b6d62" />
  <img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-live-111820?labelColor=c9432f" />
  <img alt="Status" src="https://img.shields.io/badge/Status-Alpha-111820?labelColor=a5643a" />
</p>

<p align="center">
  <code>AI Agents</code>
  ·
  <code>Workflow DAG</code>
  ·
  <code>Runtime Adapter</code>
  ·
  <code>Evidence Ledger</code>
  ·
  <code>Enterprise Data Governance</code>
</p>

Helios is a Go-native AI Workflow Compiler for business operations. It turns a natural-language business goal into an executable workflow, scoped agent roles, runtime adapter contracts, generated app surfaces, evidence records, and an auditable run history.

Live demo: `https://duang777.github.io/helios/`

Challenge direction: 四维图新企业级智能数据 Agent，让一线员工 3 秒获得准确答案，让管理决策有据可依。

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
