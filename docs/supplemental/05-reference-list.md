# 参考资料清单

本清单用于支撑 Helios 方案中的行业判断、技术路线和落地假设。资料主要用于说明企业 AI Agent、数据治理、可信 AI 和组织流程重构的趋势背景。

## 行业趋势

### McKinsey：The state of AI in 2025: Agents, innovation, and transformation

- 链接：https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- 关注点：企业 AI 使用已经非常普遍，AI Agent 进入实验和规模化探索阶段，但多数组织仍处在试点阶段，真正的企业级价值取决于工作流重构、组织机制和治理能力。
- 对 Helios 的启发：企业 AI 的下一步会从增加聊天入口，推进到把 Agent 嵌入真实业务流程，让它能够被组织持续使用和管理。

### Gartner：Task-specific AI Agents in Enterprise Apps

- 链接：https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025
- 关注点：任务型 AI Agent 将快速进入企业应用，软件形态会从静态功能菜单转向按任务触发的智能代理。
- 对 Helios 的启发：Helios 把 Agent 作为企业能力生产和复用的基本单元，而不只是单个功能入口。

### IBM：Cost of a Data Breach Report

- 链接：https://www.ibm.com/reports/data-breach
- 关注点：企业数据安全、访问控制、审计和治理仍是 AI 落地中的关键约束。
- 对 Helios 的启发：企业 Agent 必须把权限、审计、证据和人工确认放进核心架构，不能只追求生成效果。

## 技术方向

### RAG

- 关注点：通过检索增强生成，让模型基于外部知识回答问题。
- 局限：普通 RAG 更擅长召回内容，难以独立解决权限、口径、证据链、业务流程和组织记忆问题。
- Helios 处理方式：把 RAG 作为能力节点之一，纳入 Agent 编排、业务知识网络和证据账本。

### 知识图谱

- 关注点：把实体、关系、规则和上下文组织成可推理结构。
- Helios 处理方式：将客户、项目、合同、指标、组织角色、会议纪要和历史决策连接成企业语义地图，使 AI 能理解业务关系，减少对关键词匹配的依赖。

### Agent 工作流编排

- 关注点：将复杂任务拆成多个可执行节点，调用不同工具完成计划、检索、分析和输出。
- Helios 处理方式：业务人员通过自然语言定义任务，系统转化为可执行 Agent 流程，并结合最小上下文读取、权限判断和人工确认。

### 可信 AI 与证据追溯

- 关注点：企业级 AI 输出需要可解释、可复核、可审计。
- Helios 处理方式：关键结论绑定来源、版本、时间、口径、置信度和推理路径，让答案可以被管理决策使用。

## 竞品与相关案例观察

### 企业知识库问答类产品

- 常见能力：文档检索、知识库问答、引用来源、团队协作。
- 主要不足：容易停留在「找资料」，难以把业务流程、权限边界和组织经验沉淀结合起来。
- Helios 差异：从问答扩展到 Agent 能力生产，让业务侧可以配置和复用流程。

### BI Copilot 类产品

- 常见能力：自然语言查数、图表生成、指标解释。
- 主要不足：对非结构化经验、项目复盘、会议纪要和跨部门流程支持不足。
- Helios 差异：同时处理结构化指标和非结构化业务经验，并把输出沉淀为模板。

### 流程自动化 Agent

- 常见能力：自动执行任务、调用工具、生成报告。
- 主要不足：如果缺少业务知识网络和权限治理，容易出现越权、幻觉和不可追溯问题。
- Helios 差异：把权限、证据、人机协同和组织记忆作为核心能力。

## 关键词

- Enterprise AI Agent
- Data Governance
- Knowledge Graph
- Retrieval-Augmented Generation
- Agent Workflow
- Human-in-the-loop
- Evidence Ledger
- Business-side Permission Governance
- Organizational Memory
- Natural Language as Capability Interface

## 方案参考结论

企业 AI 的核心价值会从「提升个人效率」走向「重构组织能力」。Helios 的方案选择，是把自然语言交互、业务知识网络、Agent 编排、权限治理、证据追溯和组织记忆回流组合成一个闭环。这样既能响应四维图新数据治理命题，也能形成可推广到更多数据密集型企业的通用范式。
