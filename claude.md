# Claude Guide

This repository builds `Helios`, a business workflow compiler and auditable runtime: natural language → reusable workflow artifacts; CLI-first execution; GUI escalation; Pi as AI kernel; Go as control plane. `SKUFlow` remains an optional industry shell, not the kernel.

## Source of Truth

- PRD: `docs/prd/helios-prd-v0.1.md`
- Research: `docs/research/2026-07-31-helios-reposition-research.md`
- ADR: `docs/decisions/ADR-001-go-control-plane-pi-sidecar.md`
- Agent guide: `agent.md`
- Slice E (GUI): `docs/architecture/slice-e-gui.md`
- Slice C/D (Pi): `docs/architecture/slice-c-d-pi.md`
- Slice F (CLI factory): `docs/architecture/slice-f-cli-factory.md`
- Real-path defaults: `docs/architecture/real-path-defaults.md`
- Dev gate: `docs/architecture/dev-gate.md`
- Slice G (Lathe): `docs/architecture/slice-g-lathe-adapter.md` / ADR-002
- Best-fit OSS: `docs/research/2026-08-01-best-fit-oss.md`

## Collaboration Rules

- Keep `agent.md` and this file aligned when project direction changes.
- Add directory-level `agent.md` / `claude.md` files when a directory gains its own conventions.
- Record task progress in the relevant guide files when a milestone changes meaningfully.
- Prefer implementation over proposals when requirements are clear and PRD open questions are closed.
- **Dev gate:** No implementation for a new slice without an **Accepted** tech design (`docs/architecture/dev-gate.md`). Use the slice’s Required skills (Read skill files first).

## Architecture Rules

- Backend (Go) owns workflow contracts, scheduling, CLI process control, approvals, and evidence.
- Pi sidecar owns compile assistance and explicit `ai` nodes only.
- Frontend owns presentation state and API orchestration only.
- Shared API shapes must be mirrored intentionally in `web/src/api/types.ts` when the console exists.
- Evidence, artifacts, approvals, and run history are core objects, not logging leftovers.
- Prefer real paths by default (Playwright, live Pi, HTTP factory). Mock/fake/FileDB are explicit offline fallbacks — see `docs/architecture/real-path-defaults.md`.
- Do not fork Eko. Current code may be rebuilt against the PRD.
