# Helios Implementation Plan

Derived from `docs/prd/helios-prd-v0.1.md` and `docs/architecture/implementation-design-v0.1.md`.

## Goal

Ship a rebuild-friendly Helios control plane where a checked-in YAML workflow runs through registered business CLIs with approval and evidence. Add Pi compile and GUI only after that path is solid.

## Dependency Graph

```text
contracts/schema
    → domain + expr
        → demo CLIs + registry + clirunner
            → runtime (cli, approval) + evidence + fs store
                → HTTP API
                    → console (run/approve)
                    → pi-sidecar (compile, ai)
                    → gui-operator
                    → CLI factory
                    → run_workflow skill
```

## Vertical Slices

### Slice A — Deterministic run path (no Pi)
- Acceptance: `demo.lead-sync.yaml` completes via API with evidence on disk; dry-run → approval → write works; second run keeps the same CLI step order.
- Verify: `go test ./...` plus a scripted curl/run against local server.

### Slice B — Minimal console
- Acceptance: user can open YAML, start run, approve, inspect evidence.
- Verify: manual browser check against local API.

### Slice C — Pi compile assist
- Design: `docs/architecture/slice-c-d-pi.md`
- Acceptance: intent returns YAML draft; invalid drafts fail Go validation with repair loop (previousYAML+errors); mock default; live optional.
- Verify: `./scripts/smoke-compile.sh` (self-contained) + `packages/pi-sidecar` tests.

### Slice D — AI node + AI-facing run
- Design: `docs/architecture/slice-c-d-pi.md`
- Acceptance: `uses: ai` output consumed by downstream CLI; evidence records mode/model/rawTraceId; published manifest callable.
- Verify: `./scripts/smoke-lead-sync-ai.sh` + runtime tests.

### Slice E — GUI escalation
- Design: `docs/architecture/slice-e-gui.md`
- Acceptance: `when`-gated gui step stores screenshot evidence (`.png` + meta).
- Verify: gui-operator fake mode + `scripts/smoke-lead-sync-gui.sh`; optional Playwright mode.

### Slice F — CLI factory
- Design: `docs/architecture/slice-f-cli-factory.md`
- Acceptance: OpenAPI subset or Helios factory spec → Go CLI with introspect/envelope/dry-run; registers; demo workflow.
- Verify: `go test ./internal/clifactory` + `./scripts/smoke-cli-factory.sh`.

## Risks

- Existing backend domain types conflict with PRD; prefer replace over dual support.
- Pi bash must be restricted in compile/ai sessions.
- Real platform CLI is still unknown; demo CLIs unblock Slice A.

## Slice O — MVP §15 closeout (done)

- Design: `docs/architecture/slice-o-mvp-acceptance.md`
- Verify: `./scripts/smoke-mvp-acceptance.sh`
- Feishu live: `docs/acceptance/2026-08-01-feishu-live.md`

## Out of Scope for this plan

- Multi-tenant SaaS
- Temporal-scale durability
- Visual drag-and-drop editor
- Forking Eko
