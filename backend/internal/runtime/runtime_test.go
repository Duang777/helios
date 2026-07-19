package runtime

import (
	"strings"
	"testing"

	"github.com/Duang777/helios/backend/internal/compiler"
	"github.com/Duang777/helios/backend/internal/domain"
)

func TestRunExecutesWorkflowInDependencyOrder(t *testing.T) {
	wf, err := compiler.New().Compile("名创优品新品开发智能决策引擎")
	if err != nil {
		t.Fatalf("Compile returned error: %v", err)
	}

	run, err := New().Run(wf)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}

	if run.Status != domain.RunStatusCompleted {
		t.Fatalf("run status = %s, want COMPLETED", run.Status)
	}
	if len(run.NodeRuns) != len(wf.Nodes) {
		t.Fatalf("node runs = %d, want %d", len(run.NodeRuns), len(wf.Nodes))
	}
	if run.NodeRuns[0].NodeID != "trend-insight" {
		t.Fatalf("first node run = %q, want trend-insight", run.NodeRuns[0].NodeID)
	}
	if len(run.Evidence) != len(wf.Nodes) {
		t.Fatalf("evidence = %d, want %d", len(run.Evidence), len(wf.Nodes))
	}
	if len(run.Approvals) != 1 {
		t.Fatalf("approvals = %d, want 1", len(run.Approvals))
	}
}

func TestRunFailsUnresolvedDependency(t *testing.T) {
	wf := domain.WorkflowTemplate{ID: "wf", Name: "Broken", Goal: "test", Nodes: []domain.WorkflowNode{{ID: "b", Title: "B", Type: domain.NodeTypeReport, Dependencies: []string{"missing"}}}}
	run, err := New().Run(wf)
	if err == nil {
		t.Fatal("expected unresolved dependency error")
	}
	if run.Status != domain.RunStatusFailed {
		t.Fatalf("run status = %s, want FAILED", run.Status)
	}
}

func TestRunFailsUnavailableModelAdapter(t *testing.T) {
	wf, err := compiler.New().Compile("接入 Codex Runtime、Claude 和本地工具，编排一个 AI 工作流")
	if err != nil {
		t.Fatalf("Compile returned error: %v", err)
	}

	r := NewWithAdapters(StaticAdapterRegistry(map[string]domain.AdapterStatus{
		"router":        {ID: "router", Label: "Router", Available: true},
		"codex_runtime": {ID: "codex_runtime", Label: "Codex Runtime", Available: false, Reason: "CODEX_RUNTIME_URL or codex CLI is not configured"},
	}))
	run, err := r.Run(wf)
	if err == nil {
		t.Fatal("expected unavailable adapter error")
	}
	if run.Status != domain.RunStatusFailed {
		t.Fatalf("run status = %s, want FAILED", run.Status)
	}
	if len(run.NodeRuns) != 2 {
		t.Fatalf("node runs = %d, want 2", len(run.NodeRuns))
	}
	failed := run.NodeRuns[1]
	if failed.NodeID != "codex-plan" || failed.Status != domain.NodeStatusFailed {
		t.Fatalf("failed node = %s/%s, want codex-plan/FAILED", failed.NodeID, failed.Status)
	}
	if failed.Error == "" {
		t.Fatal("failed node should include adapter error")
	}
}

func TestRunExecutesLocalToolProbe(t *testing.T) {
	wf := domain.WorkflowTemplate{
		ID:   "wf_local",
		Name: "Local Tool Probe",
		Goal: "prove local tools execute",
		Nodes: []domain.WorkflowNode{{
			ID:          "tool-dispatch",
			Title:       "工具调度",
			Type:        domain.NodeTypeCode,
			AgentRoleID: "tool-agent",
			Prompt:      "probe local runtime",
			Config:      map[string]string{"runtimeAdapter": "local_tools", "provider": "shell"},
		}},
	}

	r := NewWithAdapters(StaticAdapterRegistry(map[string]domain.AdapterStatus{
		"local_tools": {ID: "local_tools", Label: "Local Tools", Available: true, Command: "pwd", Reason: "available"},
	}))
	run, err := r.Run(wf)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if run.Status != domain.RunStatusCompleted {
		t.Fatalf("run status = %s, want COMPLETED", run.Status)
	}
	output := run.NodeRuns[0].Output["adapterOutput"]
	if output == "" || !strings.Contains(run.NodeRuns[0].Output["summary"], "pwd =>") {
		t.Fatalf("local tool probe output not recorded: output=%q summary=%q", output, run.NodeRuns[0].Output["summary"])
	}
}

func TestAdapterProbeReportsDefaultCapabilities(t *testing.T) {
	t.Setenv("CODEX_RUNTIME_URL", "")
	t.Setenv("CODEX_API_KEY", "")
	t.Setenv("CODEX_RUNTIME_COMMAND", "")
	t.Setenv("CLAUDE_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("CLAUDE_COMMAND", "")
	t.Setenv("CLAUDE_RUNTIME_URL", "")
	t.Setenv("PATH", "")

	statuses := NewDefaultAdapterRegistry().Statuses()
	if len(statuses) == 0 {
		t.Fatal("expected adapter statuses")
	}
	if !adapterByID(statuses, "local_tools").Available {
		t.Fatal("local_tools should be available in local runtime")
	}
	if adapterByID(statuses, "codex_runtime").Available {
		t.Fatal("codex_runtime should not be reported available without config in tests")
	}
}

func adapterByID(statuses []domain.AdapterStatus, id string) domain.AdapterStatus {
	for _, status := range statuses {
		if status.ID == id {
			return status
		}
	}
	return domain.AdapterStatus{}
}
