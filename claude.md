# Claude Guide

This repository builds `Helios`, a general AI workflow compiler and runtime, plus the `SKUFlow` MINISO-style demo shell.

## Collaboration Rules

- Keep `agent.md` and this file aligned when project direction changes.
- Add directory-level `agent.md` / `claude.md` files when a directory gains its own conventions.
- Record task progress in the relevant guide files when a milestone changes meaningfully.
- Prefer implementation over proposals when requirements are clear.

## Architecture Rules

- Backend owns workflow contracts and execution semantics.
- Frontend owns presentation state and API orchestration only.
- Shared API shapes must be mirrored intentionally in `web/src/api/types.ts`.
- Evidence, artifacts, approvals, and run history are core objects, not logging leftovers.

