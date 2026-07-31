# Compiler Agent Guide

Slice C compile path:

1. Console / API sends `POST /api/v1/compile` with `{intent}`.
2. Go `internal/compile` asks `pi-sidecar` (`POST /compile`) for a YAML draft.
3. Go validates with `schema` + semantic rules; on failure, re-drafts with errors (default 2 repairs).
4. Response always includes `yaml` + `validation`; invalid drafts use HTTP 422.

Default sidecar mode is `HELIOS_PI_MODE=mock` (deterministic, no live model). Live Pi is a later switch.
