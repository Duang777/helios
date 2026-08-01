# Helios 开发门禁：先文档，再代码

Status: Accepted  
Date: 2026-08-01  

## Rule

**任何新模块 / 新切片：没有 Accepted 技术设计文档，不得写实现代码。**

例外（无需新切片文档）：

- 单文件 typo / 明显 bugfix（不改变契约）
- 严格按已 Accepted 文档落地，且不扩大 scope
- 测试补强、文档勘误

## 文档放哪

| 类型 | 路径 | 何时 |
|------|------|------|
| 切片技术设计 | `docs/architecture/slice-<id>-<name>.md` | **编码前**；Status=`Proposed` → 你确认后改 `Accepted` |
| 模板 | `docs/architecture/_templates/slice-tech-design.md` | 复制起步 |
| ADR | `docs/decisions/ADR-NNN-*.md` | 不可逆选型（依赖、边界、许可） |
| 调研 | `docs/research/YYYY-MM-DD-*.md` | 选型前；不替代技术设计 |
| 任务勾选 | `tasks/todo.md` | 文档 Accepted 后再勾「实现」 |

## 门禁流程

```text
调研(reuse) → 技术设计(Proposed) → 人审 Accepted → 实现(增量+TDD) → 验收命令绿 → 回写文档 Status=Implemented
```

1. 读 `docs/research/2026-08-01-best-fit-oss.md` 确认复用对象  
2. 从模板写切片技术设计（见下节必填项）  
3. **等人确认 Accepted**（或你在对话里明确说「按这个文档实现」）  
4. Agent 按文档末尾 **Skills 清单** 调用技能后编码  
5. 验收命令全部通过；把文档 Status 改为 `Implemented`，并更新 `agent.md`

## 技术设计必填项

复制 `_templates/slice-tech-design.md`，至少填齐：

1. Goal / Non-goals  
2. 复用对象（OSS）与边界（直接用 / 适配 / 只学）  
3. 架构与数据流（简图）  
4. 契约（API / YAML / CLI / 文件布局）  
5. **怎么实现**（分步增量，每步可测）  
6. **代码规范**（包路径、命名、错误、禁止事项）  
7. **Skills 清单**（本切片强制使用的 agent skills）  
8. 测试与验收命令（可复制粘贴）  
9. 风险与回滚  

Status 枚举：`Proposed` | `Accepted` | `Implemented` | `Superseded`

## Skills 用法（高质量开发）

每个切片文档必须列出 **Required skills**。实现时 Agent **先 Read 技能文件再写代码**。

| 场景 | Skill |
|------|--------|
| 写/改技术设计、ADR | `documentation-and-adrs` |
| 需求不清 | `spec-driven-development` / `interview-me` |
| 多文件实现 | `incremental-implementation` |
| 行为变更 | `test-driven-development` |
| HTTP/模块边界 | `api-and-interface-design` |
| 前端 | `frontend-ui-engineering` |
| 会话切换 / 规范漂移 | `context-engineering` |
| 安全敏感 | `security-and-hardening` |
| 提交 | `git-workflow-and-versioning`（仅用户要求提交时） |
| 高风险决策复核 | `doubt-driven-development` |

全局始终遵守：`agent.md`、`CLAUDE.md`、`real-path-defaults.md`、本门禁。

## 当前排队（未 Accepted 不得实现）

| ID | 文档 | 复用 | 状态 |
|----|------|------|------|
| G–N | `docs/architecture/slice-*.md` | 见各文档 | Implemented |
| O | `docs/architecture/slice-o-mvp-acceptance.md` | 既有 smoke | Implemented |

下一决策面：PRD **Q6**（开源/品牌）。Q2–Q5 已冻结见 ADR-003。  
可选工程（需新切片设计）：Console 打磨、CI 挂 `smoke-mvp-acceptance.sh`、更多飞书剧本。
