# Slice N — Live Compile Schema Hardening

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/architecture/slice-c-d-pi.md`, `docs/architecture/slice-j-pi-live-default.md`  
Gate: `docs/architecture/dev-gate.md`

## Goal

提高 live Pi 编译产出 **合法 Helios YAML** 的比例（此前常见 `cli: name@version` / `command+args` 伪 DSL，校验 422）：

1. 编译 prompt 嵌入完整 **schema 契约 + 正反例**  
2. 对常见误写做 **确定性 normalize**（不调用模型）  
3. mock 增加飞书 daily-brief 意图模板  
4. gated live smoke：有 key 时尽量 `validation.ok`；仍失败则打印 attempts 但不放宽 allowlist  

## Non-goals

- 保证任意意图一次成功  
- 换模型供应商  
- 编译流式 UI  

## Architecture

```text
intent + registered CLIs
        │
        ▼
buildCompilePrompt (schema + anti-patterns + example)
        │
        ▼
Pi live draft YAML
        │
        ▼
normalizeHeliosDraft (deterministic fixes)
        │
        ▼
Go validate / repair loop (unchanged)
```

## Contracts

### Prompt must include

- Required fields: `apiVersion`, `kind`, `id`, `version`, `steps`  
- CLI step: `uses: cli`, `cli: <name>`, `argv: [...]`, `sideEffect`  
- Approval: `uses: approval`, `prompt`  
- Forbidden: `cli: name@version`, `command`/`args` 代替 argv, `type: approval`, `mode: dry-run|write`  

### `normalizeHeliosDraft(yaml)`

| Pattern | Fix |
|---------|-----|
| missing `apiVersion` | prepend `helios/v1` |
| `cli: name@x.y` | `cli: name` |
| `type: approval` | `uses: approval` |
| step has `command:` + `args:` without `argv`/`uses` | convert to `uses: cli` + `argv: [command, ...args]` when parseable |

Keep normalize conservative; unparseable blocks left for repair loop.

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| N1 | 本文 | — |
| N2 | prompt + normalize + unit tests | `npm test` |
| N3 | mock feishu daily-brief keyword | mock compile test |
| N4 | smoke-compile-live 更严（ok 或明确 soft-fail log） | live smoke |
| N5 | docs / agent；提交推送 | git |

## Required skills

- `incremental-implementation`  
- `test-driven-development`  
- `documentation-and-adrs`  

## Acceptance

```bash
cd packages/pi-sidecar && npm test
./scripts/smoke-compile.sh
./scripts/smoke-compile-live.sh
```

## Risks

过度 normalize 改坏合法 YAML：只改明确反模式；单测锁定。
