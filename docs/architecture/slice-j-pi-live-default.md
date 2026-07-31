# Slice J — Pi Real-Path Default + Gated Live Smoke

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/architecture/slice-c-d-pi.md`, `docs/architecture/real-path-defaults.md`  
Gate: `docs/architecture/dev-gate.md`

## Goal

对齐「默认真路径」：

1. `HELIOS_PI_MODE` **未设置**时：有凭证 → `live`，否则 → `mock`  
2. 显式 `mock` / `live` 永远优先（单测与离线 smoke 强制 `mock`）  
3. 新增 **gated** live smoke：无 key 时 skip（exit 0），有 key 时断言 `mode=live`  
4. 健康检查与文档反映解析后的有效 mode  

## Non-goals

- 保证 live 模型输出质量 / 固定 YAML 文本  
- 改 Go compile 修复环语义  
- 把 CI 默认改成 live（CI 仍显式 `mock`）  

## Mode resolution

```text
HELIOS_PI_MODE=mock|live  →  用该值
HELIOS_PI_MODE unset      →  hasLiveAuth() ? live : mock
HELIOS_PI_MODE=其他       →  启动/请求时报错
```

`hasLiveAuth()`：以下任一非空即真：

- `HELIOS_PI_API_KEY` / `CFMAX_API_KEY` / `XPA_RELAY_API_KEY`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` / `GROQ_API_KEY` / `MISTRAL_API_KEY` / `XAI_API_KEY`

## Architecture

```text
dev-pi-sidecar.sh
  optional source .helios-dev/pi-live.env
  HELIOS_PI_MODE unset → node resolvePiMode()
        │
        ▼
  /health { mode, authConfigured, resolvedDefault: true|false }
```

## Contracts

### `packages/pi-sidecar/src/mode.js`

| Export | 行为 |
|--------|------|
| `hasLiveAuth()` | 见上 |
| `resolvePiMode()` | 返回 `mock` \| `live` |
| `effectivePiMode()` | 同 resolve；供 health / handlers |

### Scripts

| Script | 行为 |
|--------|------|
| `dev-pi-sidecar.sh` | 不再默认 `mock`；若存在 `pi-live.env` 且未设 mode，则 source |
| `smoke-compile.sh` | **仍强制** `HELIOS_PI_MODE=mock` |
| `smoke-compile-live.sh` | 无凭证 → `SKIP: no live auth` exit 0；有 → live compile 断言 `mode=live` |
| `package.json` `test` | 强制 `HELIOS_PI_MODE=mock` |

### Docs

- 更新 `slice-c-d-pi.md` Modes 表 → 指向本切片  
- `real-path-defaults.md` acceptance 改为跑 gated live smoke  

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| J1 | 本文 Accepted | — |
| J2 | `mode.js` + unit test | `npm test` |
| J3 | server / aiStep / compile 用 `resolvePiMode` | health 单测 |
| J4 | scripts + docs + agent.md | `smoke-compile.sh` 绿；live smoke skip 或绿 |
| J5 | Status Implemented；提交 | git |

## Code standards

- 只动 `packages/pi-sidecar`、相关 scripts、docs、`agent.md` / `claude.md`  
- 永不 log API key  
- 不删除 mock 路径  

## Required skills

- `documentation-and-adrs`  
- `incremental-implementation`  
- `test-driven-development`  
- `git-workflow-and-versioning`  

## Acceptance

```bash
cd packages/pi-sidecar && npm test
./scripts/smoke-compile.sh
./scripts/smoke-compile-live.sh   # SKIP or mode=live
```

## Risks / Rollback

| 风险 | 缓解 |
|------|------|
| 本机有 key 时开发者不小心烧 token | 文档说明；显式 `HELIOS_PI_MODE=mock` |
| live smoke 不稳定 | gated skip；不阻塞 CI |
| auth.json 有钥但 env 无 | 仍可能落到 mock；Follow-up 可读 Pi auth（本切片不阻塞） |

回滚：revert 本切片提交。
