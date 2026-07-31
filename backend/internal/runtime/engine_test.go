package runtime_test

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Duang777/helios/backend/internal/clirunner"
	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/guiclient"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/schema"
	"github.com/Duang777/helios/backend/internal/store"
)

func TestLeadSyncDeterministicPath(t *testing.T) {
	root := findRepoRoot(t)
	dataDir := t.TempDir()

	crmBin := buildCLI(t, root, "demo-crm")
	erpBin := buildCLI(t, root, "demo-erp")

	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-crm", crmBin); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erpBin); err != nil {
		t.Fatal(err)
	}

	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.lead-sync.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SaveWorkflow(wf); err != nil {
		t.Fatal(err)
	}

	engine := runtime.NewEngine(st, clirunner.New(reg))
	run, err := engine.Start(context.Background(), wf, map[string]any{"lead_id": "L-123"})
	if err != nil {
		t.Fatal(err)
	}

	waitStatus(t, st, run.ID, domain.RunStatusWaitingApproval, 10*time.Second)
	if err := engine.Approve(run.ID, "approve", "approve", "tester"); err != nil {
		t.Fatal(err)
	}
	final := waitStatus(t, st, run.ID, domain.RunStatusCompleted, 10*time.Second)

	order := []string{}
	for _, sr := range final.StepRuns {
		if sr.Status == domain.StepStatusCompleted {
			order = append(order, sr.StepID)
		}
	}
	want := []string{"fetch_lead", "create_po_dry", "approve", "create_po"}
	if len(order) != len(want) {
		t.Fatalf("order=%v", order)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("order=%v want=%v", order, want)
		}
	}
	if len(final.Evidence) < 3 {
		t.Fatalf("expected cli evidence, got %d", len(final.Evidence))
	}

	// second run should keep the same completed step order
	run2, err := engine.Start(context.Background(), wf, map[string]any{"lead_id": "L-123"})
	if err != nil {
		t.Fatal(err)
	}
	waitStatus(t, st, run2.ID, domain.RunStatusWaitingApproval, 10*time.Second)
	_ = engine.Approve(run2.ID, "approve", "approve", "tester")
	final2 := waitStatus(t, st, run2.ID, domain.RunStatusCompleted, 10*time.Second)
	order2 := []string{}
	for _, sr := range final2.StepRuns {
		if sr.Status == domain.StepStatusCompleted {
			order2 = append(order2, sr.StepID)
		}
	}
	for i := range want {
		if order2[i] != want[i] {
			t.Fatalf("second order=%v", order2)
		}
	}
}

type fakeAI struct{}

func (fakeAI) AIStep(_ context.Context, in pi.AIStepRequest) (pi.AIStepResponse, error) {
	lead, _ := in.Input["lead"].(map[string]any)
	data, _ := lead["data"].(map[string]any)
	id, _ := data["id"].(string)
	return pi.AIStepResponse{
		JSON: map[string]any{
			"poDraft": map[string]any{
				"id":           id,
				"sourceLeadId": id,
				"vendor":       "MockCo",
				"title":        "Mock PO",
				"amount":       1,
			},
		},
		Mode:       "mock",
		Model:      "mock/deterministic",
		RawTraceID: "t-ai",
	}, nil
}

func TestLeadSyncAIStep(t *testing.T) {
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	crmBin := buildCLI(t, root, "demo-crm")
	erpBin := buildCLI(t, root, "demo-erp")
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-crm", crmBin); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erpBin); err != nil {
		t.Fatal(err)
	}
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.lead-sync-ai.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SaveWorkflow(wf); err != nil {
		t.Fatal(err)
	}
	engine := runtime.NewEngine(st, clirunner.New(reg)).WithAI(fakeAI{})
	run, err := engine.Start(context.Background(), wf, map[string]any{"lead_id": "L-123"})
	if err != nil {
		t.Fatal(err)
	}
	waitStatus(t, st, run.ID, domain.RunStatusWaitingApproval, 10*time.Second)
	got, _ := st.GetRun(run.ID)
	var mapped bool
	for _, sr := range got.StepRuns {
		if sr.StepID == "map_po" && sr.Status == domain.StepStatusCompleted {
			mapped = true
			if sr.Output["poDraft"] == nil {
				t.Fatalf("missing poDraft: %#v", sr.Output)
			}
		}
	}
	if !mapped {
		t.Fatal("map_po not completed before approval")
	}
	if err := engine.Approve(run.ID, "approve", "approve", "tester"); err != nil {
		t.Fatal(err)
	}
	final := waitStatus(t, st, run.ID, domain.RunStatusCompleted, 10*time.Second)
	hasAIEvidence := false
	for _, ev := range final.Evidence {
		if ev.Type == "ai" {
			hasAIEvidence = true
			if ev.InputSummary["mode"] != "mock" {
				t.Fatalf("ai evidence mode=%v", ev.InputSummary["mode"])
			}
			if ev.InputSummary["model"] != "mock/deterministic" {
				t.Fatalf("ai evidence model=%v", ev.InputSummary["model"])
			}
		}
	}
	if !hasAIEvidence {
		t.Fatal("expected ai evidence")
	}
	var createPO *domain.StepRun
	for i := range final.StepRuns {
		if final.StepRuns[i].StepID == "create_po" {
			createPO = &final.StepRuns[i]
		}
	}
	if createPO == nil || createPO.Status != domain.StepStatusCompleted {
		t.Fatalf("create_po=%v", createPO)
	}
	// PO must come from AI-mapped draft (title Mock PO), not raw CRM lead.
	data, _ := createPO.Output["data"].(map[string]any)
	if data["title"] != "Mock PO" {
		t.Fatalf("expected AI-mapped title, got %#v", createPO.Output)
	}
}

type fakeGUI struct {
	calls     int
	helpCalls int
	lastHelp  string
}

func (f *fakeGUI) ScreenshotAndConfirm(_ context.Context, in guiclient.ScreenshotAndConfirmRequest) (guiclient.ScreenshotAndConfirmResponse, error) {
	f.calls++
	if in.URL == "" {
		return guiclient.ScreenshotAndConfirmResponse{}, fmt.Errorf("missing url")
	}
	return guiclient.ScreenshotAndConfirmResponse{
		OK:          true,
		Screenshot:  []byte{0x89, 0x50, 0x4e, 0x47},
		ContentType: "image/png",
		Mode:        "fake",
	}, nil
}

func (f *fakeGUI) Run(_ context.Context, in guiclient.RunRequest) (guiclient.RunResponse, error) {
	f.calls++
	if len(in.Steps) == 0 {
		return guiclient.RunResponse{}, fmt.Errorf("missing steps")
	}
	return guiclient.RunResponse{
		OK:          true,
		Screenshot:  []byte{0x89, 0x50, 0x4e, 0x47},
		ContentType: "image/png",
		Mode:        "fake",
		Results:     []map[string]any{{"op": "open"}},
	}, nil
}

func (f *fakeGUI) StartHumanHelp(_ context.Context, in guiclient.HumanHelpStartRequest) (guiclient.HumanHelpStartResponse, error) {
	f.helpCalls++
	f.lastHelp = in.Reason
	return guiclient.HumanHelpStartResponse{
		HelpID:    "help_test",
		Status:    "waiting",
		Reason:    in.Reason,
		Mode:      "fake",
		ViewerURL: "http://127.0.0.1:8792/v1/human_help/help_test/viewer",
	}, nil
}

func (f *fakeGUI) ResolveHumanHelp(_ context.Context, in guiclient.HumanHelpResolveRequest) error {
	if in.HelpID == "" {
		return fmt.Errorf("missing helpId")
	}
	return nil
}

func TestLeadSyncGUIEscalation(t *testing.T) {
	t.Setenv("DEMO_ERP_NEEDS_GUI", "1")
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	crmBin := buildCLI(t, root, "demo-crm")
	erpBin := buildCLI(t, root, "demo-erp")
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-crm", crmBin); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erpBin); err != nil {
		t.Fatal(err)
	}
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.lead-sync-gui.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := schema.SemanticValidate(wf); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveWorkflow(wf); err != nil {
		t.Fatal(err)
	}
	gui := &fakeGUI{}
	engine := runtime.NewEngine(st, clirunner.New(reg)).WithGUI(gui)
	run, err := engine.Start(context.Background(), wf, map[string]any{"lead_id": "L-123"})
	if err != nil {
		t.Fatal(err)
	}
	waitStatus(t, st, run.ID, domain.RunStatusWaitingApproval, 10*time.Second)
	if err := engine.Approve(run.ID, "approve", "approve", "tester"); err != nil {
		t.Fatal(err)
	}
	final := waitStatus(t, st, run.ID, domain.RunStatusCompleted, 15*time.Second)

	var guiStep *domain.StepRun
	for i := range final.StepRuns {
		if final.StepRuns[i].StepID == "gui_confirm" {
			guiStep = &final.StepRuns[i]
		}
	}
	if guiStep == nil || guiStep.Status != domain.StepStatusCompleted {
		t.Fatalf("gui_confirm status=%v", guiStep)
	}
	if gui.calls != 1 {
		t.Fatalf("gui calls=%d", gui.calls)
	}
	foundShot := false
	for _, ev := range final.Evidence {
		if ev.Type == "gui" && ev.ScreenshotRef != "" {
			foundShot = true
			if _, err := os.Stat(filepath.Join(dataDir, "runs", final.ID, ev.ScreenshotRef)); err != nil {
				t.Fatalf("screenshot missing: %v", err)
			}
		}
	}
	if !foundShot {
		t.Fatal("expected gui screenshot evidence")
	}
}

func TestHumanHelpBlocksUntilResolved(t *testing.T) {
	dataDir := t.TempDir()
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	wf := domain.Workflow{
		APIVersion: "helios/v1",
		Kind:       "Workflow",
		ID:         "demo.human-help",
		Version:    1,
		Steps: []domain.Step{
			{
				ID:     "need_help",
				Uses:   domain.StepUsesGUI,
				Action: "human_help",
				Prompt: "Please finish login",
				Out:    "help",
			},
		},
	}
	gui := &fakeGUI{}
	engine := runtime.NewEngine(st, clirunner.New(nil)).WithGUI(gui)
	run, err := engine.Start(context.Background(), wf, nil)
	if err != nil {
		t.Fatal(err)
	}
	waiting := waitStatus(t, st, run.ID, domain.RunStatusWaitingHuman, 5*time.Second)
	var step *domain.StepRun
	for i := range waiting.StepRuns {
		if waiting.StepRuns[i].StepID == "need_help" {
			step = &waiting.StepRuns[i]
		}
	}
	if step == nil || step.Status != domain.StepStatusWaitingHuman {
		t.Fatalf("step=%v", step)
	}
	if gui.helpCalls != 1 || gui.lastHelp != "Please finish login" {
		t.Fatalf("helpCalls=%d last=%q", gui.helpCalls, gui.lastHelp)
	}
	if err := engine.ResolveHumanHelp(context.Background(), run.ID, "need_help", true, "done", "tester"); err != nil {
		t.Fatal(err)
	}
	final := waitStatus(t, st, run.ID, domain.RunStatusCompleted, 5*time.Second)
	for _, sr := range final.StepRuns {
		if sr.StepID == "need_help" && sr.Status != domain.StepStatusCompleted {
			t.Fatalf("expected COMPLETED, got %s", sr.Status)
		}
	}
}

func TestLeadSyncGUISkippedWhenNoEscalation(t *testing.T) {
	t.Setenv("DEMO_ERP_NEEDS_GUI", "0")
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	crmBin := buildCLI(t, root, "demo-crm")
	erpBin := buildCLI(t, root, "demo-erp")
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-crm", crmBin); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erpBin); err != nil {
		t.Fatal(err)
	}
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.lead-sync-gui.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	gui := &fakeGUI{}
	engine := runtime.NewEngine(st, clirunner.New(reg)).WithGUI(gui)
	run, err := engine.Start(context.Background(), wf, map[string]any{"lead_id": "L-123"})
	if err != nil {
		t.Fatal(err)
	}
	waitStatus(t, st, run.ID, domain.RunStatusWaitingApproval, 10*time.Second)
	_ = engine.Approve(run.ID, "approve", "approve", "tester")
	final := waitStatus(t, st, run.ID, domain.RunStatusCompleted, 15*time.Second)
	for _, sr := range final.StepRuns {
		if sr.StepID == "gui_confirm" && sr.Status != domain.StepStatusSkipped {
			t.Fatalf("expected SKIPPED, got %s", sr.Status)
		}
	}
	if gui.calls != 0 {
		t.Fatalf("gui should not run, calls=%d", gui.calls)
	}
}

func waitStatus(t *testing.T, st *store.FS, id string, want domain.RunStatus, timeout time.Duration) domain.Run {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		run, err := st.GetRun(id)
		if err == nil && run.Status == want {
			return run
		}
		if err == nil && (run.Status == domain.RunStatusFailed || run.Status == domain.RunStatusAborted) {
			t.Fatalf("run ended as %s err=%s", run.Status, run.Error)
		}
		time.Sleep(30 * time.Millisecond)
	}
	run, _ := st.GetRun(id)
	t.Fatalf("timeout waiting for %s, last=%s err=%s", want, run.Status, run.Error)
	return run
}

func buildCLI(t *testing.T, root, name string) string {
	t.Helper()
	out := filepath.Join(t.TempDir(), name)
	cmd := exec.Command("go", "build", "-o", out, "./cmd/"+name)
	cmd.Dir = filepath.Join(root, "backend")
	cmd.Env = os.Environ()
	if outBytes, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build %s: %v\n%s", name, err, outBytes)
	}
	return out
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := wd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "workflows", "demo.lead-sync.yaml")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("repo root not found")
	return ""
}
