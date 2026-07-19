package compiler

import (
	"crypto/sha1"
	"encoding/hex"
	"strings"
	"time"

	"github.com/Duang777/helios/backend/internal/domain"
)

type Compiler struct {
	now func() time.Time
}

func New() *Compiler {
	return &Compiler{now: time.Now}
}

func (c *Compiler) Compile(goal string) (domain.WorkflowTemplate, error) {
	goal = strings.TrimSpace(goal)
	if goal == "" {
		return domain.WorkflowTemplate{}, ErrEmptyGoal
	}

	scenario := detectScenario(goal)
	if scenario == "skuflow" {
		return c.compileSKUFlow(goal), nil
	}

	return c.compileGeneric(goal), nil
}

var ErrEmptyGoal = errString("goal is required")

type errString string

func (e errString) Error() string { return string(e) }

func detectScenario(goal string) string {
	normalized := strings.ToLower(goal)
	keywords := []string{"miniso", "名创", "新品", "sku", "爆品", "产品开发", "上市"}
	for _, keyword := range keywords {
		if strings.Contains(normalized, strings.ToLower(keyword)) {
			return "skuflow"
		}
	}
	return "generic"
}

func (c *Compiler) compileSKUFlow(goal string) domain.WorkflowTemplate {
	nodes := []domain.WorkflowNode{
		node("trend-insight", "Trend Insight", domain.NodeTypeLLMTask, "research-agent", "Extract consumer trend signals, emerging jobs-to-be-done, and category demand clues.", nil, []string{"trendBrief"}),
		node("idea-framing", "Product Idea Framing", domain.NodeTypeForm, "pm-agent", "Convert trend signals into a testable SKU concept with target persona, use case, price band, and emotional value.", []string{"trend-insight"}, []string{"conceptCard"}),
		node("competitor-scan", "Competitor Scan", domain.NodeTypeLLMTask, "research-agent", "Compare competing products, negative reviews, differentiators, and substitution risks.", []string{"idea-framing"}, []string{"competitorMatrix"}),
		node("supply-validation", "Supply Chain Validation", domain.NodeTypeApproval, "ops-agent", "Validate manufacturability, lead time, MOQ, compliance, and gross margin assumptions.", []string{"competitor-scan"}, []string{"supplyGate"}),
		node("launch-test", "Launch Test Dashboard", domain.NodeTypeDashboard, "data-agent", "Define launch test cohort, metrics, channel experiment, and success thresholds.", []string{"supply-validation"}, []string{"launchDashboard"}),
		node("review-decision", "Review Decision Report", domain.NodeTypeReport, "review-agent", "Summarize evidence, risks, decision options, and next operating cadence.", []string{"launch-test"}, []string{"decisionReport"}),
	}

	return domain.WorkflowTemplate{
		ID:       stableID("workflow", goal),
		Name:     "SKUFlow New Product Decision Engine",
		Scenario: "skuflow",
		Goal:     goal,
		Summary:  "MINISO-style workflow from trend insight to evidence-backed launch decision.",
		Nodes:    nodes,
		Edges:    edgesFromNodes(nodes),
		AgentRoles: []domain.AgentRole{
			{ID: "research-agent", Name: "Research Agent", Scope: "Market, social, competitor, and review signals for the active node only.", Permissions: []string{"read_public_research", "summarize_evidence"}},
			{ID: "pm-agent", Name: "PM Agent", Scope: "Product definition, target persona, SKU assumptions, and decision criteria.", Permissions: []string{"draft_forms", "shape_requirements"}},
			{ID: "ops-agent", Name: "Ops Agent", Scope: "Supply, compliance, lead time, cost, and feasibility gates.", Permissions: []string{"request_approval", "record_gate"}},
			{ID: "data-agent", Name: "Data Agent", Scope: "Experiment metrics, dashboard thresholds, and launch signal interpretation.", Permissions: []string{"build_dashboard", "calculate_metrics"}},
			{ID: "review-agent", Name: "Review Agent", Scope: "Final synthesis, evidence traceability, risk review, and reusable playbook output.", Permissions: []string{"write_report", "audit_run"}},
		},
		AppPages: []domain.AppPage{
			conceptForm("idea-framing"),
			approvalPage("supply-validation"),
			dashboardPage("launch-test"),
			reportPage("review-decision"),
		},
		CreatedAt: c.now(),
	}
}

func (c *Compiler) compileGeneric(goal string) domain.WorkflowTemplate {
	nodes := []domain.WorkflowNode{
		runtimeNode("intent-router", "意图路由", domain.NodeTypeForm, "orchestrator-agent", "解析用户的一句话目标，生成可执行任务边界、上下文范围、模型选择和审批策略。", nil, []string{"intentPacket"}, "router", "manual_chat"),
		runtimeNode("codex-plan", "Codex 计划生成", domain.NodeTypeLLMTask, "codex-agent", "调用 Codex Runtime 生成分步执行计划、文件变更边界、验证命令和回滚说明。", []string{"intent-router"}, []string{"executionPlan"}, "codex_runtime", "codex"),
		runtimeNode("claude-review", "Claude 方案复核", domain.NodeTypeLLMTask, "review-agent", "调用 Claude 对计划做产品语义、风险、遗漏步骤和提示词边界复核。", []string{"codex-plan"}, []string{"reviewNotes"}, "claude", "claude"),
		runtimeNode("tool-dispatch", "工具调度", domain.NodeTypeCode, "tool-agent", "把通过复核的步骤分发到本地 shell、文件系统、浏览器自动化、HTTP API 和 MCP 工具。", []string{"claude-review"}, []string{"toolCalls"}, "local_tools", "shell_browser_mcp"),
		runtimeNode("human-gate", "人工审批", domain.NodeTypeApproval, "approval-agent", "对高风险命令、外部服务调用和生产态执行做人工确认，并保留可恢复检查点。", []string{"tool-dispatch"}, []string{"approvalGate"}, "human_gate", "approval"),
		runtimeNode("execution-run", "运行执行", domain.NodeTypeDashboard, "runtime-agent", "按 DAG 依赖顺序执行通过审批的节点，记录 stdout、stderr、模型摘要、token 和产物。", []string{"human-gate"}, []string{"runtimeRun"}, "helios_runtime", "dag_runtime"),
		runtimeNode("audit-ledger", "审计归档", domain.NodeTypeReport, "audit-agent", "汇总 Codex、Claude、工具调用、审批、证据和验证结果，形成可追踪运行报告。", []string{"execution-run"}, []string{"auditReport"}, "audit_store", "evidence_ledger"),
	}

	return domain.WorkflowTemplate{
		ID:       stableID("workflow", goal),
		Name:     "Helios Runtime 编排工作台",
		Scenario: "generic",
		Goal:     goal,
		Summary:  "面向 Codex Runtime、Claude、本地工具和人工审批的可审计 AI 工作流编排。Runtime 会真实探测 adapter 可用性，未配置模型节点会阻断并记录原因，本地工具节点执行安全探测。",
		Nodes:    nodes,
		Edges:    edgesFromNodes(nodes),
		AgentRoles: []domain.AgentRole{
			{ID: "orchestrator-agent", Name: "编排 Agent", Scope: "只读取本次用户目标、项目规则和运行策略，用于拆解任务边界。", Permissions: []string{"route_intent", "select_adapter"}},
			{ID: "codex-agent", Name: "Codex Agent", Scope: "仓库上下文、目标文件、验证命令和代码变更计划。", Permissions: []string{"plan_code_changes", "propose_commands"}},
			{ID: "review-agent", Name: "Claude Review Agent", Scope: "计划摘要、风险点、产品语义和提示词边界，不接触不必要文件。", Permissions: []string{"review_plan", "flag_risk"}},
			{ID: "tool-agent", Name: "工具执行 Agent", Scope: "已批准命令、文件路径、浏览器目标和 MCP 工具参数。", Permissions: []string{"run_shell", "edit_files", "drive_browser", "call_mcp"}},
			{ID: "approval-agent", Name: "审批 Agent", Scope: "高风险操作说明、影响面、回滚方案和审批记录。", Permissions: []string{"pause_run", "request_approval", "resume_run"}},
			{ID: "runtime-agent", Name: "Runtime Agent", Scope: "DAG 依赖、节点输入输出、运行状态和重试策略。", Permissions: []string{"execute_dag", "record_status"}},
			{ID: "audit-agent", Name: "审计 Agent", Scope: "模型调用摘要、工具调用证据、审批记录、产物和验证结果。", Permissions: []string{"audit_run", "write_report"}},
		},
		AppPages: []domain.AppPage{
			runtimeBriefForm("intent-router"),
			runtimeAdapterPage("tool-dispatch"),
			approvalPage("human-gate"),
			dashboardPage("execution-run"),
			reportPage("audit-ledger"),
		},
		CreatedAt: c.now(),
	}
}

func node(id, title string, typ domain.NodeType, agentID, prompt string, dependencies []string, outputs []string) domain.WorkflowNode {
	return runtimeNode(id, title, typ, agentID, prompt, dependencies, outputs, "deterministic_mvp", "template")
}

func runtimeNode(id, title string, typ domain.NodeType, agentID, prompt string, dependencies []string, outputs []string, adapter string, provider string) domain.WorkflowNode {
	if dependencies == nil {
		dependencies = []string{}
	}
	return domain.WorkflowNode{ID: id, Title: title, Type: typ, AgentRoleID: agentID, Prompt: prompt, Inputs: dependencies, Outputs: outputs, Dependencies: dependencies, Config: map[string]string{"executionMode": "adapter_contract", "runtimeAdapter": adapter, "provider": provider}}
}

func edgesFromNodes(nodes []domain.WorkflowNode) []domain.WorkflowEdge {
	edges := make([]domain.WorkflowEdge, 0, len(nodes)-1)
	for _, n := range nodes {
		for _, dep := range n.Dependencies {
			edges = append(edges, domain.WorkflowEdge{From: dep, To: n.ID})
		}
	}
	return edges
}

func conceptForm(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-concept-card", NodeID: nodeID, Kind: "form", Title: "SKU Concept Card", Fields: []domain.AppField{
		{ID: "persona", Label: "Target persona", Type: "text", Required: true},
		{ID: "occasion", Label: "Use occasion", Type: "text", Required: true},
		{ID: "priceBand", Label: "Price band", Type: "select", Required: true, Options: []string{"RMB 19-29", "RMB 29-49", "RMB 49-79", "RMB 79+"}},
		{ID: "emotionalValue", Label: "Emotional value", Type: "textarea", Required: true},
	}}
}

func runtimeBriefForm(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-runtime-brief", NodeID: nodeID, Kind: "form", Title: "运行目标", Fields: []domain.AppField{
		{ID: "trigger", Label: "触发方式", Type: "select", Required: true, Options: []string{"对话消息", "Webhook", "定时任务", "工作流回调", "人工点击"}},
		{ID: "model", Label: "主模型", Type: "select", Required: true, Options: []string{"Codex Runtime", "Claude", "OpenAI", "DeepSeek"}},
		{ID: "toolScope", Label: "工具范围", Type: "select", Required: true, Options: []string{"只读", "文件编辑", "Shell", "浏览器 + MCP"}},
		{ID: "approval", Label: "审批规则", Type: "textarea", Required: false},
	}}
}

func runtimeAdapterPage(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-runtime-adapters", NodeID: nodeID, Kind: "table", Title: "Runtime Adapter 表", Sections: []domain.AppSection{
		{Title: "模型 Adapter", Items: []string{"Codex Runtime", "Claude", "OpenAI", "DeepSeek"}},
		{Title: "工具 Adapter", Items: []string{"Shell", "文件系统", "浏览器自动化", "HTTP API", "MCP"}},
	}}
}

func approvalPage(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-approval-" + nodeID, NodeID: nodeID, Kind: "approval", Title: "Decision Gate", Sections: []domain.AppSection{{Title: "Review checklist", Items: []string{"Evidence is attached", "Owner is assigned", "Risk threshold is explicit", "Rollback path is documented"}}}}
}

func dashboardPage(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-dashboard-" + nodeID, NodeID: nodeID, Kind: "dashboard", Title: "Signal Dashboard", Sections: []domain.AppSection{{Title: "Metrics", Items: []string{"Cycle time", "Confidence", "Conversion signal", "Exception rate"}}}}
}

func reportPage(nodeID string) domain.AppPage {
	return domain.AppPage{ID: "app-report-" + nodeID, NodeID: nodeID, Kind: "report", Title: "Evidence-backed Review", Sections: []domain.AppSection{{Title: "Report sections", Items: []string{"Decision", "Evidence", "Risks", "Next actions"}}}}
}

func stableID(prefix, value string) string {
	sum := sha1.Sum([]byte(strings.ToLower(strings.TrimSpace(value))))
	return prefix + "_" + hex.EncodeToString(sum[:])[:12]
}
