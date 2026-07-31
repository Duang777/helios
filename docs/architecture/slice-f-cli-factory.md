# Slice F — CLI Factory

Status: Accepted (implemented 2026-08-01)
Date: 2026-08-01  
Parent: `docs/architecture/implementation-design-v0.1.md` §14, PRD F-L4/F-L5

## Goal

Turn a **Helios Factory Spec** (or a minimal OpenAPI 3 document) into a Go CLI that:

1. Implements `introspect` matching `contracts/cli-introspect.schema.json`
2. Uses Helios JSON envelope (`ok` / `data` / `error`) and exit codes
3. Supports `--dry-run` on write commands (exit 9 on dry-run success)
4. Ships `SKILL.md` + `README.md` for Pi / humans
5. Registers with Helios CLI registry and can appear in a tiny workflow

## Non-goals (this slice)

- Full OpenAPI coverage (callbacks, webhooks, OAuth flows, arbitrary `$ref` graphs)
- Calling Lathe (done in Slice G — `docs/architecture/slice-g-lathe-adapter.md`)
- Pi-driven “smart” resource naming (mechanical mapping only; Pi assist later)
- Multi-language codegen (Go only for F)

## Inputs

### A. Helios Factory Spec (primary)

Schema: `contracts/cli-factory-spec.schema.json`

```json
{
  "name": "demo-inventory",
  "version": "0.1.0",
  "description": "Demo inventory platform CLI",
  "commands": [
    {
      "path": ["items", "get"],
      "sideEffect": "read",
      "args": [{ "name": "--id", "type": "string", "required": true }],
      "handler": "storeGet",
      "resource": "items"
    }
  ]
}
```

Handlers:

| handler | Behavior |
|---------|----------|
| `httpGet` / `httpList` / `httpCreate` | **Default when OpenAPI has `servers`** — real HTTP against `baseUrl` |
| `storeGet` / `storeList` / `storeCreate` | Offline FileDB under `~/.helios/demo-data` (no `baseUrl`) |

Env override for generated HTTP CLIs: `{NAME}_BASE_URL` (e.g. `DEMO_INVENTORY_BASE_URL`).

### B. OpenAPI 3 (subset → Factory Spec)

Supported:

- `servers[0].url` → factory `baseUrl` + `http*` handlers (else FileDB `store*`)
- `GET /{resource}` → `{resource} list`
- `GET /{resource}/{id}` → `{resource} get --id`
- `POST /{resource}` → `{resource} create --from-json` (+ dry-run)

`operationId` optional; path segments drive command names. Platform CLI name from `--name`.

## Outputs

```text
<outDir>/
  main.go       # generated CLI
  SKILL.md
  README.md
  factory.json  # copy of resolved spec (provenance)
```

Binary name = spec `name`. Build: `go build -o <name> .` from outDir (module path injected or use `package main` with replace to helios democli — **generated CLIs import `github.com/Duang777/helios/backend/internal/democli`** and must live under the Helios module or use a generated stub that vendors envelope helpers).

**Decision:** generate under `backend/cmd/<name>/` (or temp under module) so imports resolve without a separate go.mod.

## Tooling

```bash
# From repo root / backend:
go run ./cmd/helios-factory generate --spec examples/cli-factory/demo-inventory.factory.json --out backend/cmd/demo-inventory
go run ./cmd/helios-factory from-openapi --openapi examples/cli-factory/demo-inventory.openapi.yaml --name demo-inventory --out /tmp/spec.json
```

Package: `backend/internal/clifactory` (parse, convert, generate).  
Command: `backend/cmd/helios-factory`.

## Runtime / Helios integration

- Register: `POST /api/v1/clis/register` with generated binary path
- Demo workflow: `workflows/demo.inventory-create.yaml` (list/get optional; create with dry-run → approval → write)
- Smoke: `scripts/smoke-cli-factory.sh` generates → builds → registers → runs workflow

## Security

- Generator is offline / local files only (no fetch of remote OpenAPI in MVP unless `--allow-http`)
- Generated CLI: HTTP client (preferred) or FileDB offline; no shell
- Registry still allowlists from introspect
- Demo API: `backend/cmd/demo-inventory-api` (in-memory REST matching OpenAPI)

## Acceptance

1. `go test ./internal/clifactory` — OpenAPI → http handlers + generate
2. Generated `demo-inventory introspect` validates
3. `./scripts/smoke-cli-factory.sh` starts inventory API + COMPLETED run
4. Docs: this file + `docs/architecture/real-path-defaults.md`

## Follow-ups

- Broader OpenAPI (`$ref`, auth schemes) — consider oapi-codegen for complex APIs
- Pi assist for messy OpenAPI → factory spec
- Lathe/FuseCLI post-process adapter
