# Slice G — Lathe Adapter (CLI Factory)

Status: Implemented  
Date: 2026-08-01  
Parent: `docs/architecture/slice-f-cli-factory.md`, PRD F-L4/F-L5  
Reuse: Lathe (MIT) — `docs/research/2026-08-01-best-fit-oss.md`  
Gate: `docs/architecture/dev-gate.md`  
ADR: `docs/decisions/ADR-002-lathe-cli-factory-engine.md`

## Goal

把 **复杂 OpenAPI → 生产级 Agent CLI** 的生成工作交给 [Lathe](https://github.com/lathe-cli/lathe)，Helios 只做：

1. 输入规范化（OpenAPI / factory spec）  
2. 调用 Lathe（或消费其生成物）  
3. **归一**到 Helios `introspect` + democli envelope（若 Lathe 输出不完全兼容）  
4. 注册进 registry，可被 workflow / smoke 跑通  

简单 demo（inventory）可继续用现有 `http*` / `store*` 模板；**新真实平台 API 默认走 Lathe 路径**。

## Non-goals

- Fork Lathe 进 monorepo  
- 支持 Speakeasy/Fern 为默认引擎（许可/商业；可另开 ADR）  
- 一次吃下全部 OpenAPI `$ref` / OAuth 复杂流（跟 Lathe 能力走，文档化限制）  
- 改 Helios runtime 调度语义  

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| Lathe CLI (`lathe bootstrap` / `codegen`) | MIT | **外部工具**：子进程或文档化手动步骤；生成 Go Cobra CLI |
| 现有 `clifactory` | — | 保留为 `engine=helios` 轻量路径；新增 `engine=lathe` |
| oapi-codegen | Apache-2.0 | **本切片不做**；记 Follow-up（typed client 层） |

## Architecture

```text
OpenAPI / factory.json
        │
        ▼
helios-factory generate --engine=lathe
        │
        ├─► (optional) write lathe config overlay
        ├─► exec: lathe bootstrap|codegen
        └─► adapt: ensure introspect + Helios envelope shim if needed
        │
        ▼
backend/cmd/<name>/  (or outDir)
        │
        ▼
go build → register → workflow smoke
```

## Contracts

### CLI

```bash
# 现有
helios-factory generate --spec <factory.json> --out <dir>
helios-factory from-openapi --openapi <file> --name <cli> --out <spec.json>

# 本切片新增
helios-factory generate --engine=lathe --openapi <file> --name <cli> --out <dir>
helios-factory generate --engine=helios --spec <factory.json> --out <dir>   # 默认保持兼容
```

- `--engine` 缺省：`helios`（向后兼容）；文档与 real-path 推荐真实 API 用 `lathe`。  
- Lathe 未安装：清晰错误 + 安装提示（`go install` / release URL），**不静默回退 mock**。

### Helios introspect

生成 CLI 必须能：

```bash
./<cli> introspect   # 或 Lathe catalog JSON → 适配成 contracts/cli-introspect.schema.json
```

若 Lathe 已有 `commands --json` / catalog：写 **adapter** 生成 `introspect` 子命令或包装二进制（优先少包装，能补子命令就补）。

### Envelope

写操作：`--dry-run` → exit 9；JSON `{ok,command,data,error,meta}`。  
若 Lathe 默认输出不同：适配层映射，并在 SKILL.md 写明。

## Implementation plan

| Step | 交付 | 证明 |
|------|------|------|
| G1 | 设计定稿 + ADR（若把 Lathe 列为推荐引擎） | 本文 Accepted |
| G2 | `helios-factory --engine=lathe`：检测 lathe、生成最小 petstore/inventory OpenAPI | `go test ./internal/clifactory` + 集成测（可 `t.Skip` 若无 lathe） |
| G3 | introspect 适配（catalog → Helios schema） | schema 校验通过 |
| G4 | smoke：`smoke-cli-factory-lathe.sh`（需本机 lathe）+ CI 文档说明 | 脚本 COMPLETED 或明确 skip |
| G5 | 更新 slice-f、real-path、agent.md | 文档一致 |

## Code standards

- 包：`backend/internal/clifactory/lathe/`（exec + adapt），不要把 Lathe 源码 vendoring 进树  
- 命名：`EngineHelios` / `EngineLathe`  
- 错误：用户可读；包含「如何安装 lathe」  
- 生成物：`// Code generated ...`；`factory.json` / `lathe.yaml` 留 provenance  
- **Never：** 下载任意远程 OpenAPI（保持现有 `--allow-http` 策略）；把 Speakeasy 做成默认  

## Required skills

1. `documentation-and-adrs` — 本文 + 必要时 ADR-00x Lathe  
2. `api-and-interface-design` — factory CLI 标志与 introspect 适配边界  
3. `source-driven-development` — 对照 Lathe 官方 docs/`cli-usage.md`  
4. `test-driven-development` — 适配器单测先于 exec 集成  
5. `incremental-implementation` — G2→G5  
6. `security-and-hardening` — 子进程参数、路径、无 shell 拼接  

## Security

- `exec.CommandContext` 固定 argv，禁止 `bash -c`  
- `outDir` 限制在模块内（已有约束）  
- 不把上游 API 密钥写进生成代码；auth 走 Lathe/本地 profile  

## Acceptance

```bash
# 无 lathe：单元测试仍绿
cd backend && go test ./internal/clifactory/ -count=1

# 有 lathe：
which lathe
./scripts/smoke-cli-factory-lathe.sh   # 新建；COMPLETED
```

## Risks / rollback

- Lathe 输出与 Helios envelope 差距大 → 薄包装 CLI（`helios-wrap-<name>`）只做 introspect + 转发（同 helios-lark 模式）  
- Lathe API 不稳定 → pin 版本号写进文档与脚本  

## Follow-ups

- oapi-codegen 作为 Lathe 之后的 typed 增强  
- Pi 辅助从混乱 OpenAPI 生成 overlay  
