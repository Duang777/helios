# ADR-001: Go control plane with Pi sidecar

## Status

Accepted (product direction, pending implementation)

## Date

2026-07-31

## Context

Helios needs:

1. Natural language compilation into reusable workflow artifacts
2. Deterministic-ish execution centered on business platform CLIs
3. An AI agent kernel without maintaining a custom ReAct loop
4. Approvals, evidence, and process supervision as first-class behavior

Candidates considered: fork Eko, all-TypeScript on Pi, pure Go agent, Go orchestration plus Pi.

## Decision

Use **Go** for the control plane (compile validation, DAG runtime, CLI process runner, approvals, evidence, HTTP API).

Use **Pi** as a **sidecar / RPC worker** for NL compile assistance, explicit `ai` nodes, and intelligent parts of CLI factory.

Do **not** fork Eko. Borrow plan/execute ideas only.

Do **not** reimplement the agent loop in Go.

## Alternatives Considered

### Fork Eko

- Pros: Existing planner, parallel agents, pause/resume
- Cons: Browser-agent centered; conflicts with Pi kernel choice; high fork cost
- Rejected

### All TypeScript (Pi embeds everything)

- Pros: Fastest prototype
- Cons: Weaker fit for long-term compiler/runtime/evidence narrative in Go
- Deferred as optional spike path, not the product backbone

### Pure Go agent kernel

- Pros: Single language
- Cons: Abandons Pi; large rebuild of agent harness
- Rejected

## Consequences

- Dual-language repo and a stable Pi RPC contract are required
- CLI allowlisting and sandboxing live in Go, not inside Pi defaults
- Workflow YAML schema becomes the source of truth between compile and execute
- Existing Helios code may be replaced to match this ADR
