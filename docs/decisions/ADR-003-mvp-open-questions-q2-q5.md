# ADR-003: Freeze MVP answers for PRD Q2–Q5

## Status

Accepted

## Date

2026-08-01

## Context

PRD §14 Q1 is closed (Feishu + `feishu.daily-brief`). Slices A–O delivered MVP §15. Remaining open questions Q2–Q5 still block calling the product **technically frozen**. Current code already embodies one consistent answer for each; prolonging “开放” only creates drift risk.

Q6 (open-source / brand vs helios.ai) is legal/comms and is **out of scope** for this ADR.

## Decision

Freeze MVP / v0.1 product answers as follows:

| # | Decision | Rationale |
|---|----------|-----------|
| **Q2** | **YAML 定义 DAG/契约**；**TS 做节点实现与工具链**（Pi sidecar、gui-operator、后续 `uses: code` / 表达式插件等）。**不另开一套 TS-first workflow 语言**（禁止「YAML 工作流」与「TS 工作流」双主对等）。 | 制品仍可 diff/审计；TS 能力用在实现面，不分裂两套编译器与技能模型 |
| **Q3** | **Pi = HTTP sidecar（本机进程）**。不承诺独立长期 TS 微服务拓扑。 | 与 ADR-001 一致；部署简单；微服务可在 Q5 升级后再议 |
| **Q4** | **证据默认本地文件系统**（`HELIOS_DATA_DIR`）。DB 非 MVP。 | 审计路径已跑通；DB 增加运维与迁移成本 |
| **Q5** | **目标部署 = 本地单机开发者/实施机**。内网多用户服务非 MVP。 | 安全模型按本机信任边界；不做多租户鉴权 |

## Alternatives considered (summary)

- **Q2 两套对等 workflow 语言（YAML-first 与 TS-first）：** TS 能力很强，但双主会让编译器、技能、校验、console 翻倍 → **拒绝**。改用「YAML 编排 + TS 扩展/实现」。  
- **Q2 纯禁 TS：** 不可取；sidecar/operator/未来代码节点都需要 TS。
- **Q3 常驻微服务：** 便于多实例共享 Pi → 等有内网部署需求再开 ADR  
- **Q4 Postgres/SQLite：** 检索更强 → 有多机/检索需求再迁  
- **Q5 内网服务：** 需鉴权、审计隔离 → 明确非 MVP  

## Amendment (2026-08-01)

Clarified Q2 after product feedback: TS is welcome for **implementation and toolchain**, not as a second peer workflow language.

## Consequences

- PRD §14 Q2–Q5 marked closed; only Q6 remains for full product定稿  
- New slices must not silently reverse these without a superseding ADR  
- Post-MVP `uses: code` (TS) is in-bounds if the **workflow artifact** remains YAML DAG + schema  
- Console / CI work may proceed without waiting on Q6  

## References

- PRD: `docs/prd/helios-prd-v0.1.md` §14  
- ADR-001: Go control plane + Pi sidecar  
- Slice O: `docs/architecture/slice-o-mvp-acceptance.md`  
