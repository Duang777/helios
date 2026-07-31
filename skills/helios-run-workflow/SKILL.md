---
name: helios-run-workflow
description: Run a published Helios workflow via Manifest-constrained params. Use when an agent should execute a reusable Helios workflow instead of ad-hoc scripting.
---

# Helios run_workflow

Only call workflows that are **published**. Params must match the Manifest exactly (unknown keys rejected).

## Base URL

Default: `http://127.0.0.1:8080/api/v1`

## Steps

1. List manifests

```bash
curl -s "$HELIOS_API/manifests"
```

2. Inspect one manifest (allowed params / side effects)

```bash
curl -s "$HELIOS_API/manifests/{id}"
```

3. Start via AI-facing entrypoint

```bash
curl -s -X POST "$HELIOS_API/run_workflow" \
  -H 'content-type: application/json' \
  -d '{"id":"demo.lead-sync","params":{"lead_id":"L-123"}}'
```

4. Poll until terminal status

```bash
curl -s "$HELIOS_API/runs/{runId}"
```

Statuses: `RUNNING` | `WAITING_APPROVAL` | `COMPLETED` | `FAILED` | `ABORTED`

5. If `WAITING_APPROVAL`

```bash
curl -s -X POST "$HELIOS_API/runs/{runId}/approval" \
  -H 'content-type: application/json' \
  -d '{"stepId":"approve","decision":"approve","actor":"agent"}'
```

## Rules

- Prefer `POST /run_workflow` over raw `/workflows/{id}/runs` so unpublished workflows cannot be started by agents.
- Do not invent param names; only use Manifest `params`.
- Do not bypass approvals for write side effects.
