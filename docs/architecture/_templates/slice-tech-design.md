# Slice \<ID\> — \<Title\>

Status: Proposed  
Date: YYYY-MM-DD  
Parent: `docs/architecture/implementation-design-v0.1.md` §N / PRD F-xx  
Reuse: `docs/research/2026-08-01-best-fit-oss.md`  
Gate: `docs/architecture/dev-gate.md`

## Goal

一句话：交付什么、给谁用、成功长什么样。

## Non-goals

- …

## Reuse

| 对象 | 许可 | 用法 |
|------|------|------|
| … | MIT/Apache | 直接用 / 适配层 / 只学模式 |

**禁止：** fork Eko；默认路径引入自由浏览器 Agent；未经 ADR 引入 ELv2/商业生成器为内核依赖。

## Architecture

```text
(简图：谁调用谁，证据落哪)
```

## Contracts

### Workflow / API / CLI / 文件

- 请求/响应形状或 YAML 片段
- 错误语义与 exit code
- 与现有契约的兼容性（破坏性变更必须另开 ADR）

## Implementation plan（增量）

| Step | 交付 | 证明 |
|------|------|------|
| 1 | … | `go test …` / `npm test` / smoke |
| 2 | … | … |

每步结束后系统保持可测；禁止一大坨未测代码。

## Code standards

- 包/目录：
- 命名：
- 错误处理：
- 日志/证据：
- **Never：** …

## Required skills（实现前 Read）

1. `incremental-implementation`
2. `test-driven-development`
3. `api-and-interface-design`（若动契约）
4. `documentation-and-adrs`（收尾回写 Status）
5. （按需）…

## Security

- 密钥、本机绑定、超时、路径穿越、选择器来源……

## Acceptance

```bash
# 可复制命令；全部绿才算完成
```

## Risks / rollback

- …

## Follow-ups（不阻塞本切片）

- …
