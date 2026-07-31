# ADR-002: Lathe as recommended OpenAPI→CLI factory engine

## Status
Accepted

## Date
2026-08-01

## Context
Helios needs to turn third-party OpenAPI into Agent-friendly CLIs that register via `introspect`. Slice F shipped a lightweight in-tree template (`engine=helios`). For real platform APIs we need production-grade Cobra generation without adopting Speakeasy (Elastic License 2.0 / platform).

## Decision
Use **Lathe** (`github.com/lathe-cli/lathe`, MIT, pin **v0.5.2**) as the recommended external generator via `helios-factory --engine=lathe`. Helios owns:
- scaffolding + subprocess invoke
- catalog → Helios `introspect` adapter
- thin wrapper binary for registry compatibility

`engine=helios` remains the default for backward compatibility and tiny demos.

## Alternatives Considered

### Speakeasy
- Pros: polished agent-mode CLI
- Cons: ELv2; not suitable as Helios factory kernel
- Rejected for default engine

### openapi-generator / oapi-codegen alone
- Pros: mature HTTP clients
- Cons: not agent CLI / Skills / catalog first
- oapi-codegen deferred as typed-client follow-up under Lathe CLIs

### Hand-written templates only
- Pros: zero deps
- Cons: does not scale to real OpenAPI
- Kept as `engine=helios` fallback

## Consequences
- Developers must install `lathe` for the Lathe path; missing binary fails loudly (no silent mock).
- Generated projects are separate Go modules under `outDir`.
- Wrapper provides Helios `introspect`; Lathe binary handles real HTTP.
