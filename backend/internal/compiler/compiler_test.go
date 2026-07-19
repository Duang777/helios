package compiler

import "testing"

func TestCompileSKUFlowGoal(t *testing.T) {
	c := New()
	wf, err := c.Compile("为名创优品设计新品开发智能决策引擎，提升爆品命中率")
	if err != nil {
		t.Fatalf("Compile returned error: %v", err)
	}

	if wf.Scenario != "skuflow" {
		t.Fatalf("scenario = %q, want skuflow", wf.Scenario)
	}
	if len(wf.Nodes) != 6 {
		t.Fatalf("nodes = %d, want 6", len(wf.Nodes))
	}
	if wf.Nodes[0].ID != "trend-insight" {
		t.Fatalf("first node = %q, want trend-insight", wf.Nodes[0].ID)
	}
	if len(wf.Edges) != 5 {
		t.Fatalf("edges = %d, want 5", len(wf.Edges))
	}
	if len(wf.AppPages) != 4 {
		t.Fatalf("app pages = %d, want 4", len(wf.AppPages))
	}
}

func TestCompileGenericAutomationGoal(t *testing.T) {
	wf, err := New().Compile("接入 Codex Runtime、Claude 和本地工具，编排一个从需求到执行、审批、审计的 AI 工作流")
	if err != nil {
		t.Fatalf("Compile returned error: %v", err)
	}

	if wf.Scenario != "generic" {
		t.Fatalf("scenario = %q, want generic", wf.Scenario)
	}
	if len(wf.Nodes) != 7 {
		t.Fatalf("nodes = %d, want 7", len(wf.Nodes))
	}
	if wf.Nodes[0].ID != "intent-router" {
		t.Fatalf("first node = %q, want intent-router", wf.Nodes[0].ID)
	}
	if wf.Nodes[1].Config["runtimeAdapter"] != "codex_runtime" {
		t.Fatalf("workflow node adapter = %q, want codex_runtime", wf.Nodes[1].Config["runtimeAdapter"])
	}
	if wf.Nodes[2].Config["runtimeAdapter"] != "claude" {
		t.Fatalf("analysis node adapter = %q, want claude", wf.Nodes[2].Config["runtimeAdapter"])
	}
	if len(wf.AppPages) != 5 {
		t.Fatalf("app pages = %d, want 5", len(wf.AppPages))
	}
}

func TestCompileRejectsEmptyGoal(t *testing.T) {
	_, err := New().Compile("   ")
	if err == nil {
		t.Fatal("expected error for empty goal")
	}
}
