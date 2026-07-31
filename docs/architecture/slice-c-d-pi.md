# Slice C/D — Pi Compile + AI Step (Hardening)

Status: Accepted (hardening pass 2026-07-31)  
Parent: `docs/architecture/implementation-design-v0.1.md` §8–9  
Quality bar: match `docs/architecture/slice-e-gui.md` completeness

## Goal

Pi sidecar is a first-class Helios component: mock-default, live-optional, self-contained smoke, closed demo loops, and evidence that records **mode / model / rawTraceId**.

## Modes

| `HELIOS_PI_MODE` | Behavior |
|---|---|
| `mock` (default) | Deterministic compile + ai-step; offline CI |
| `live` | Real Pi session with `noTools: "all"` |

## Contracts

### HTTP (`packages/pi-sidecar`)

| Method | Path | Success | Errors |
|--------|------|---------|--------|
| GET | `/health` | `{status, service, mode, authConfigured, provider?, model?}` | — |
| POST | `/compile` | `{yaml, mode, model?, rawTraceId}` | 400 bad JSON; 422 missing intent; 500/502 compile failure |
| POST | `/ai-step` | `{json, mode, model?, rawTraceId}` | 400 bad JSON; 422 validation; 502 upstream |

### Compile request

```json
{
  "intent": "...",
  "clis": [{ "name", "version", "commands": [{ "path", "sideEffect" }] }],
  "hints": {},
  "previousYAML": "...",
  "previousErrors": ["..."]
}
```

Live prompt **must** include previousYAML when repairing. Mock repair uses the same fields.

### AI step request

```json
{
  "runId": "...",
  "stepId": "...",
  "prompt": "...",
  "input": {},
  "outputSchema": { "type": "object", "required": ["poDraft"] },
  "model": "provider/id"  
}
```

`model` overrides `HELIOS_PI_MODEL` when set. Sidecar validates `required[]`; Go runtime re-validates required keys before completing the step.

## Evidence (AI)

`type: "ai"` evidence `inputSummary` includes:

- `prompt` (truncated)
- `model` (effective model string from sidecar response)
- `mode` (`mock`|`live`)
- `rawTraceId`

`outputSummary.keys` lists top-level JSON keys.

Compile API `Result` includes top-level `mode` from the successful attempt (last draft mode).

## Demo closure

`workflows/demo.lead-sync-ai.yaml`:

1. `fetch_lead` → `lead`
2. `map_po` (ai) → `mapped.poDraft` (**consumed**)
3. `create_po_dry` / `create_po` use `--from-json "${mapped.poDraft}"`
4. `demo-erp po create` accepts lead-shaped **or** poDraft-shaped payloads (`id`|`sourceLeadId`, `title`|`vendor`, `amount`)

## Security

- Compile / ai-step sessions: `noTools: "all"`
- Never log API keys
- Bind `127.0.0.1`
- CFMax: User-Agent override required (`scripts/setup-cfmax-pi.sh`)

## Retry policy

- Sidecar live ai-step: **one** repair retry with previous error text
- Go `pi.Client.AIStep`: **no** blind second attempt (sidecar owns retry)
- Go compile: up to `MaxRepairs` with previousYAML + errors

## Mock discipline

- Intent must match keywords (线索/lead/采购/crm/erp, 飞书/feishu, …) **or** explicit `__broken__` fixture
- Do **not** silently map arbitrary intent to lead-sync when CLIs happen to be registered
- Unknown intent → clear approval-only placeholder or structured error YAML that fails validation intentionally is OK; prefer placeholder with message in description

## Acceptance

1. `node --test` in `packages/pi-sidecar` covers compile, ai-step, server HTTP, repair with previousYAML in prompt builder
2. `go test ./internal/pi ./internal/compile ./internal/runtime` (AI evidence has mode/model)
3. `./scripts/smoke-compile.sh` self-starts mock sidecar + API
4. `./scripts/smoke-lead-sync-ai.sh` self-contained; asserts AI evidence + PO created from mapped draft
5. Design linked from `agent.md` / `CLAUDE.md`

## Non-goals

- Browser agent / factory codegen (Slice F)
- Pixel GUI (Slice E)
- Guaranteeing live model quality beyond smoke
