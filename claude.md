# Claude Guide

This repository builds `Helios`, a business workflow compiler and auditable runtime: natural language → reusable workflow artifacts; CLI-first execution; GUI escalation; Pi as AI kernel; Go as control plane. `SKUFlow` remains an optional industry shell, not the kernel.

## Source of Truth

- PRD: `docs/prd/helios-prd-v0.1.md`
- Research: `docs/research/2026-07-31-helios-reposition-research.md`
- ADR: `docs/decisions/ADR-001-go-control-plane-pi-sidecar.md`
- ADR-003 (Q2–Q5): `docs/decisions/ADR-003-mvp-open-questions-q2-q5.md`
- Agent guide: `agent.md`
- Slice E (GUI): `docs/architecture/slice-e-gui.md`
- Slice C/D (Pi): `docs/architecture/slice-c-d-pi.md`
- Slice F (CLI factory): `docs/architecture/slice-f-cli-factory.md`
- Real-path defaults: `docs/architecture/real-path-defaults.md`
- Dev gate: `docs/architecture/dev-gate.md`
- Slice G (Lathe): `docs/architecture/slice-g-lathe-adapter.md` / ADR-002
- Slice H (human_help): `docs/architecture/slice-h-human-help-handoff.md`
- Slice I (Feishu): `docs/architecture/slice-i-feishu-thicken.md` / `docs/feishu-cli.md`
- Slice J (Pi live default): `docs/architecture/slice-j-pi-live-default.md`
- Slice K (evidence viewer): `docs/architecture/slice-k-evidence-viewer.md`
- Slice L (GUI ↔ playwright-cli): `docs/architecture/slice-l-gui-playwright-cli.md`
- Slice M (Feishu Q1 playbook): `docs/architecture/slice-m-feishu-daily-brief.md`
- Slice N (live compile harden): `docs/architecture/slice-n-live-compile-harden.md`
- Slice O (MVP §15): `docs/architecture/slice-o-mvp-acceptance.md`
- Slice P (OpenCLI): `docs/architecture/slice-p-opencli-adapter.md` / `docs/opencli.md`
- Feishu live accept: `docs/acceptance/2026-08-01-feishu-live.md`
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
