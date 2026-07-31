package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Duang777/helios/backend/internal/clirunner"
	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/httpapi"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/schema"
	"github.com/Duang777/helios/backend/internal/store"
)

func TestAPILeadSyncFlow(t *testing.T) {
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	crm := buildCLI(t, root, "demo-crm")
	erp := buildCLI(t, root, "demo-erp")
	if _, err := reg.Register("demo-crm", crm); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erp); err != nil {
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
	srv := httptest.NewServer(httpapi.NewServer(st, reg, engine, nil).Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]any{"params": map[string]any{"lead_id": "L-123"}})
	resp, err := http.Post(srv.URL+"/api/v1/workflows/demo.lead-sync/runs", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var started map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&started)
	runObj := started["run"].(map[string]any)
	runID := runObj["id"].(string)

	waitAPI(t, srv.URL, runID, domain.RunStatusWaitingApproval)

	appr, _ := json.Marshal(map[string]string{"stepId": "approve", "decision": "approve", "actor": "tester"})
	resp2, err := http.Post(srv.URL+"/api/v1/runs/"+runID+"/approval", "application/json", bytes.NewReader(appr))
	if err != nil {
		t.Fatal(err)
	}
	resp2.Body.Close()

	final := waitAPI(t, srv.URL, runID, domain.RunStatusCompleted)
	steps := final["stepRuns"].([]any)
	if len(steps) != 4 {
		t.Fatalf("steps=%d", len(steps))
	}
}

func waitAPI(t *testing.T, base, runID string, want domain.RunStatus) map[string]any {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(base + "/api/v1/runs/" + runID)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&payload)
		resp.Body.Close()
		run := payload["run"].(map[string]any)
		status := domain.RunStatus(run["status"].(string))
		if status == want {
			return run
		}
		if status == domain.RunStatusFailed || status == domain.RunStatusAborted {
			t.Fatalf("run %s", status)
		}
		time.Sleep(30 * time.Millisecond)
	}
	t.Fatalf("timeout waiting for %s", want)
	return nil
}

func buildCLI(t *testing.T, root, name string) string {
	t.Helper()
	out := filepath.Join(t.TempDir(), name)
	cmd := exec.Command("go", "build", "-o", out, "./cmd/"+name)
	cmd.Dir = filepath.Join(root, "backend")
	if b, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build %s: %v\n%s", name, err, b)
	}
	return out
}

func TestAPICompileWithMockSidecar(t *testing.T) {
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	crm := buildCLI(t, root, "demo-crm")
	erp := buildCLI(t, root, "demo-erp")
	if _, err := reg.Register("demo-crm", crm); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erp); err != nil {
		t.Fatal(err)
	}
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}

	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/compile" {
			http.NotFound(w, r)
			return
		}
		raw, _ := os.ReadFile(filepath.Join(root, "workflows", "demo.lead-sync.yaml"))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"yaml":       string(raw),
			"mode":       "mock",
			"rawTraceId": "test-trace",
		})
	}))
	defer sidecar.Close()

	piClient := pi.NewClient(sidecar.URL)
	compiler := compile.New(piClient, func() ([]pi.CLISummary, error) {
		recs, err := reg.List()
		if err != nil {
			return nil, err
		}
		return compile.SummarizeCLIs(recs), nil
	})
	engine := runtime.NewEngine(st, clirunner.New(reg))
	srv := httptest.NewServer(httpapi.NewServer(st, reg, engine, compiler).Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]any{"intent": "把线索 L-123 同步成采购单，写前要审批"})
	resp, err := http.Post(srv.URL+"/api/v1/compile", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var result map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&result)
	validation := result["validation"].(map[string]any)
	if validation["ok"] != true {
		t.Fatalf("validation=%v", validation)
	}
	if !bytes.Contains([]byte(result["yaml"].(string)), []byte("demo.lead-sync")) {
		t.Fatalf("yaml=%v", result["yaml"])
	}
}

func TestPublishAndRunWorkflowRejectsUnknownParams(t *testing.T) {
	root := findRepoRoot(t)
	dataDir := t.TempDir()
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	crm := buildCLI(t, root, "demo-crm")
	erp := buildCLI(t, root, "demo-erp")
	if _, err := reg.Register("demo-crm", crm); err != nil {
		t.Fatal(err)
	}
	if _, err := reg.Register("demo-erp", erp); err != nil {
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
	srv := httptest.NewServer(httpapi.NewServer(st, reg, engine, nil).Handler())
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/workflows/demo.lead-sync/publish", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("publish status=%d", resp.StatusCode)
	}

	bad, _ := json.Marshal(map[string]any{"id": "demo.lead-sync", "params": map[string]any{"lead_id": "L-1", "hack": true}})
	resp2, err := http.Post(srv.URL+"/api/v1/run_workflow", "application/json", bytes.NewReader(bad))
	if err != nil {
		t.Fatal(err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", resp2.StatusCode)
	}

	okBody, _ := json.Marshal(map[string]any{"id": "demo.lead-sync", "params": map[string]any{"lead_id": "L-123"}})
	resp3, err := http.Post(srv.URL+"/api/v1/run_workflow", "application/json", bytes.NewReader(okBody))
	if err != nil {
		t.Fatal(err)
	}
	defer resp3.Body.Close()
	if resp3.StatusCode != http.StatusCreated {
		t.Fatalf("run_workflow status=%d", resp3.StatusCode)
	}
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	wd, _ := os.Getwd()
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
