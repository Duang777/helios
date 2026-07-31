package manifest_test

import (
	"testing"

	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/manifest"
)

func TestBuildAndFilter(t *testing.T) {
	wf := domain.Workflow{
		ID:          "demo.x",
		Version:     1,
		Description: "Demo",
		Params: map[string]domain.Param{
			"lead_id": {Type: "string", Required: true},
		},
		Requires: domain.Requires{CLIs: []domain.CLIRequirement{{Name: "demo-crm"}}},
		Steps: []domain.Step{
			{ID: "a", Uses: domain.StepUsesCLI, CLI: "demo-crm", SideEffect: domain.SideEffectRead, Argv: []string{"x"}},
			{ID: "b", Uses: domain.StepUsesApproval, Prompt: "ok?"},
			{ID: "c", Uses: domain.StepUsesCLI, CLI: "demo-erp", SideEffect: domain.SideEffectWrite, Argv: []string{"y"}, Needs: []string{"b"}},
		},
	}
	m := manifest.Build(wf)
	if m.SideEffectLevel != domain.SideEffectWrite {
		t.Fatalf("level=%s", m.SideEffectLevel)
	}
	if !m.RequiresApprovals {
		t.Fatal("expected approvals")
	}
	if len(m.CLIs) < 2 {
		t.Fatalf("clis=%v", m.CLIs)
	}
	filtered, err := manifest.FilterParams(m, map[string]any{"lead_id": "L-1", "extra": 1})
	if err == nil {
		t.Fatalf("expected unknown param error, got %v", filtered)
	}
	filtered, err = manifest.FilterParams(m, map[string]any{"lead_id": "L-1"})
	if err != nil {
		t.Fatal(err)
	}
	if filtered["lead_id"] != "L-1" {
		t.Fatalf("%v", filtered)
	}
}
