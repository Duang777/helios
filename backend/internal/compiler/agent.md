# Compiler Agent Guide

Slice C compile path:

1. Console / API sends `POST /api/v1/compile` with `{intent}`.
2. Go `internal/compile` asks `pi-sidecar` (`POST /compile`) for a YAML draft.
3. Go validates with `schema` + semantic rules; on failure, re-drafts with errors (default 2 repairs).
4. Response always includes `yaml` + `validation`; invalid drafts use HTTP 422.

Desktop Workflow Studio consumes the additive compile contract:

- `yaml`: validated draft YAML when `validation.ok=true`
- `validation`: `{ok, errors}` for save/run gating
- `attempts`: legacy attempt list kept for existing callers
- `repairAttempts`: desktop-friendly alias of the attempt list for validation/repair UI
- `ir`: lightweight normalized workflow shape for graph preview and panels
- `workflow`: full Helios workflow object kept for existing callers

Validation uses strict YAML decoding: unknown root fields or unknown step fields are compile errors.
Agents must only emit properties defined by the Helios workflow contract.

Default sidecar mode is `HELIOS_PI_MODE=mock` (deterministic, no live model). Live Pi is a later switch.
