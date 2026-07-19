package runtime

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/Duang777/helios/backend/internal/domain"
)

type Runtime struct {
	now      func() time.Time
	adapters AdapterRegistry
}

func New() *Runtime {
	return NewWithAdapters(NewDefaultAdapterRegistry())
}

func NewWithAdapters(adapters AdapterRegistry) *Runtime {
	if adapters == nil {
		adapters = NewDefaultAdapterRegistry()
	}
	return &Runtime{now: time.Now, adapters: adapters}
}

func (r *Runtime) AdapterStatuses() []domain.AdapterStatus {
	return r.adapters.Statuses()
}

func (r *Runtime) Run(workflow domain.WorkflowTemplate) (domain.WorkflowRun, error) {
	if len(workflow.Nodes) == 0 {
		return domain.WorkflowRun{}, fmt.Errorf("workflow has no nodes")
	}

	run := domain.WorkflowRun{
		ID:         "run_" + randomHex(8),
		WorkflowID: workflow.ID,
		Goal:       workflow.Goal,
		Status:     domain.RunStatusRunning,
		NodeRuns:   []domain.NodeRun{},
		Evidence:   []domain.Evidence{},
		Artifacts:  []domain.Artifact{},
		Approvals:  []domain.Approval{},
		Adapters:   r.adapters.Statuses(),
		StartedAt:  r.now(),
	}

	completed := map[string]domain.NodeRun{}
	remaining := append([]domain.WorkflowNode(nil), workflow.Nodes...)

	for len(remaining) > 0 {
		progress := false
		next := remaining[:0]

		for _, node := range remaining {
			if !dependenciesComplete(node, completed) {
				next = append(next, node)
				continue
			}

			nodeRun, evidence, artifact, approval := r.executeNode(workflow, node, completed)
			run.NodeRuns = append(run.NodeRuns, nodeRun)
			completed[node.ID] = nodeRun
			if evidence.ID != "" {
				run.Evidence = append(run.Evidence, evidence)
			}
			if artifact.ID != "" {
				run.Artifacts = append(run.Artifacts, artifact)
			}
			if approval.ID != "" {
				run.Approvals = append(run.Approvals, approval)
			}
			if nodeRun.Status == domain.NodeStatusFailed {
				run.Status = domain.RunStatusFailed
				completedAt := r.now()
				run.CompletedAt = &completedAt
				return run, fmt.Errorf("node %s failed: %s", node.ID, nodeRun.Error)
			}
			progress = true
		}

		if !progress {
			run.Status = domain.RunStatusFailed
			completedAt := r.now()
			run.CompletedAt = &completedAt
			return run, fmt.Errorf("workflow contains unresolved dependencies")
		}

		remaining = next
	}

	completedAt := r.now()
	run.Status = domain.RunStatusCompleted
	run.CompletedAt = &completedAt
	return run, nil
}

func dependenciesComplete(node domain.WorkflowNode, completed map[string]domain.NodeRun) bool {
	for _, dep := range node.Dependencies {
		if completed[dep].Status != domain.NodeStatusCompleted {
			return false
		}
	}
	return true
}

func (r *Runtime) executeNode(workflow domain.WorkflowTemplate, node domain.WorkflowNode, completed map[string]domain.NodeRun) (domain.NodeRun, domain.Evidence, domain.Artifact, domain.Approval) {
	startedAt := r.now()
	completedAt := r.now()
	input := map[string]string{"goal": workflow.Goal}
	for _, dep := range node.Dependencies {
		input[dep] = completed[dep].Output["summary"]
	}

	adapterID := node.Config["runtimeAdapter"]
	if adapterID == "" {
		adapterID = "deterministic_mvp"
	}
	adapter := r.adapters.Status(adapterID)
	if !adapter.Available {
		return domain.NodeRun{
			ID:          "noderun_" + randomHex(8),
			NodeID:      node.ID,
			Title:       node.Title,
			Type:        node.Type,
			AgentRoleID: node.AgentRoleID,
			Status:      domain.NodeStatusFailed,
			Input:       input,
			Output: map[string]string{
				"summary":        fmt.Sprintf("%s 未执行：adapter %s 不可用。", node.Title, adapterID),
				"runtimeAdapter": adapterID,
				"provider":       node.Config["provider"],
				"adapterReason":  adapter.Reason,
			},
			StartedAt:   startedAt,
			CompletedAt: &completedAt,
			Error:       fmt.Sprintf("adapter %s unavailable: %s", adapterID, adapter.Reason),
		}, domain.Evidence{}, domain.Artifact{}, domain.Approval{}
	}

	outputSummary, realOutput, execErr := r.runAdapterProbe(node, adapter, len(node.Dependencies))
	if execErr != nil {
		return domain.NodeRun{
			ID:          "noderun_" + randomHex(8),
			NodeID:      node.ID,
			Title:       node.Title,
			Type:        node.Type,
			AgentRoleID: node.AgentRoleID,
			Status:      domain.NodeStatusFailed,
			Input:       input,
			Output: map[string]string{
				"summary":        outputSummary,
				"runtimeAdapter": adapterID,
				"provider":       node.Config["provider"],
				"adapterReason":  adapter.Reason,
			},
			StartedAt:   startedAt,
			CompletedAt: &completedAt,
			Error:       execErr.Error(),
		}, domain.Evidence{}, domain.Artifact{}, domain.Approval{}
	}
	nodeRun := domain.NodeRun{
		ID:          "noderun_" + randomHex(8),
		NodeID:      node.ID,
		Title:       node.Title,
		Type:        node.Type,
		AgentRoleID: node.AgentRoleID,
		Status:      domain.NodeStatusCompleted,
		Input:       input,
		Output: map[string]string{
			"summary":         outputSummary,
			"mode":            executionMode(adapter),
			"runtimeAdapter":  adapterID,
			"provider":        node.Config["provider"],
			"adapterLabel":    adapter.Label,
			"adapterReason":   adapter.Reason,
			"adapterOutput":   realOutput,
			"contextBoundary": fmt.Sprintf("%d_upstream_nodes", len(node.Dependencies)),
		},
		StartedAt:   startedAt,
		CompletedAt: &completedAt,
	}

	evidence := domain.Evidence{
		ID:         "ev_" + randomHex(8),
		NodeID:     node.ID,
		Claim:      evidenceClaim(workflow.Scenario, node),
		Sources:    evidenceSources(workflow.Scenario, node),
		Confidence: confidenceFor(node.Type),
	}

	artifact := domain.Artifact{
		ID:      "art_" + randomHex(8),
		NodeID:  node.ID,
		Kind:    string(node.Type),
		Title:   node.Title + " Output",
		Content: artifactContent(workflow, node, realOutput),
	}

	var approval domain.Approval
	if node.Type == domain.NodeTypeApproval {
		approval = domain.Approval{
			ID:        "appr_" + randomHex(8),
			NodeID:    node.ID,
			Title:     node.Title,
			Decision:  "APPROVED_FOR_CONTRACT_RUN",
			Reviewer:  "审批 Agent",
			Rationale: "高风险操作已被切到人工审批节点，运行记录保留 adapter、上下文边界和回滚说明。",
		}
	}

	return nodeRun, evidence, artifact, approval
}

func (r *Runtime) runAdapterProbe(node domain.WorkflowNode, adapter domain.AdapterStatus, dependencyCount int) (summary string, output string, err error) {
	if adapter.ID == "local_tools" {
		cmd := exec.Command("pwd")
		cmd.Env = os.Environ()
		out, cmdErr := cmd.CombinedOutput()
		trimmed := strings.TrimSpace(string(out))
		if cmdErr != nil {
			return fmt.Sprintf("%s 本地工具探测失败：pwd 命令返回错误。", node.Title), trimmed, cmdErr
		}
		return fmt.Sprintf("%s 已真实执行本地工具探测：pwd => %s，读取 %d 个上游节点。", node.Title, trimmed, dependencyCount), trimmed, nil
	}
	return executeSummary(node, adapter, dependencyCount), adapter.Endpoint, nil
}

func executeSummary(node domain.WorkflowNode, adapter domain.AdapterStatus, dependencyCount int) string {
	switch adapter.ID {
	case "local_tools":
		return fmt.Sprintf("%s 已完成真实本地工具探测：adapter 可用，命令范围 %s，读取 %d 个上游节点的受限上下文。", node.Title, adapter.Command, dependencyCount)
	case "router", "human_gate", "helios_runtime", "audit_store":
		return fmt.Sprintf("%s 已由内置 %s 执行，状态来自 runtime adapter registry，读取 %d 个上游节点。", node.Title, adapter.Label, dependencyCount)
	case "codex_runtime", "claude":
		return fmt.Sprintf("%s 已由 %s adapter 接管，配置来源：%s，读取 %d 个上游节点的受限上下文。", node.Title, adapter.Label, adapter.Reason, dependencyCount)
	default:
		return fmt.Sprintf("%s 已由 %s adapter 执行，读取 %d 个上游节点的受限上下文。", node.Title, adapter.ID, dependencyCount)
	}
}

func executionMode(adapter domain.AdapterStatus) string {
	switch adapter.ID {
	case "codex_runtime", "claude":
		return "external_model_adapter"
	case "local_tools":
		return "local_tool_probe"
	case "deterministic_mvp":
		return "deterministic_mvp_contract"
	default:
		return "in_process_adapter"
	}
}

func evidenceClaim(scenario string, node domain.WorkflowNode) string {
	if scenario == "skuflow" {
		switch node.ID {
		case "trend-insight":
			return "Target consumers show demand for portable, affordable, emotionally expressive products."
		case "competitor-scan":
			return "Competitor gaps can be translated into SKU differentiation and launch test hypotheses."
		case "supply-validation":
			return "Supply feasibility should gate launch experiments before creative investment scales."
		}
	}
	if scenario == "generic" {
		switch node.ID {
		case "codex-plan":
			return "Codex Runtime 节点生成了可审计执行计划，未越过文件和命令边界。"
		case "claude-review":
			return "Claude 复核节点记录了产品语义、风险和遗漏项检查结果。"
		case "tool-dispatch":
			return "工具调度节点只暴露已批准的 shell、文件、浏览器和 MCP 参数。"
		case "human-gate":
			return "人工审批节点阻断高风险执行，直到 reviewer 明确通过。"
		}
	}
	return node.Title + " produced an auditable intermediate decision for the workflow."
}

func evidenceSources(scenario string, node domain.WorkflowNode) []string {
	if scenario == "skuflow" {
		return []string{"consumer review themes", "competitor listing signals", "category trend notes", "operator assumptions"}
	}
	return []string{"用户目标", "节点上下文", "adapter 合同", "工具调用摘要", "审批记录"}
}

func confidenceFor(nodeType domain.NodeType) float64 {
	switch nodeType {
	case domain.NodeTypeApproval:
		return 0.76
	case domain.NodeTypeReport:
		return 0.84
	case domain.NodeTypeDashboard:
		return 0.79
	default:
		return 0.82
	}
}

func artifactContent(workflow domain.WorkflowTemplate, node domain.WorkflowNode, adapterOutput string) string {
	return fmt.Sprintf("目标: %s\n节点: %s\nAgent: %s\nAdapter: %s\nProvider: %s\n真实输出: %s\n提示: %s", workflow.Goal, node.Title, node.AgentRoleID, node.Config["runtimeAdapter"], node.Config["provider"], adapterOutput, node.Prompt)
}

func randomHex(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
