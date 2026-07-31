package schema_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Duang777/helios/backend/internal/schema"
)

func TestLoadAndValidateDemoWorkflow(t *testing.T) {
	root := findRepoRoot(t)
	path := filepath.Join(root, "workflows", "demo.lead-sync.yaml")
	wf, err := schema.LoadWorkflowFile(path)
	if err != nil {
		t.Fatalf("LoadWorkflowFile: %v", err)
	}
	if err := schema.SemanticValidate(wf); err != nil {
		t.Fatalf("SemanticValidate: %v", err)
	}
	if wf.ID != "demo.lead-sync" {
		t.Fatalf("id=%s", wf.ID)
	}
	if len(wf.Steps) != 4 {
		t.Fatalf("steps=%d", len(wf.Steps))
	}
}

func TestLoadAndValidateDemoGUIWorkflow(t *testing.T) {
	root := findRepoRoot(t)
	path := filepath.Join(root, "workflows", "demo.lead-sync-gui.yaml")
	wf, err := schema.LoadWorkflowFile(path)
	if err != nil {
		t.Fatalf("LoadWorkflowFile: %v", err)
	}
	if err := schema.SemanticValidate(wf); err != nil {
		t.Fatalf("SemanticValidate: %v", err)
	}
	if wf.ID != "demo.lead-sync-gui" {
		t.Fatalf("id=%s", wf.ID)
	}
}

func TestStructuralValidate_GUIRequiresURL(t *testing.T) {
	_, err := schema.LoadWorkflowYAML([]byte(`
apiVersion: helios/v1
kind: Workflow
id: bad.gui
version: 1
params: {}
steps:
  - id: g
    uses: gui
    action: screenshot_and_confirm
    gui: {}
`))
	if err == nil {
		t.Fatal("expected gui.url error")
	}
}

func TestSemanticValidate_DetectsCycle(t *testing.T) {
	wf, err := schema.LoadWorkflowYAML([]byte(`
apiVersion: helios/v1
kind: Workflow
id: bad.cycle
version: 1
params: {}
steps:
  - id: a
    uses: approval
    needs: [b]
    prompt: "a"
  - id: b
    uses: approval
    needs: [a]
    prompt: "b"
`))
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if err := schema.SemanticValidate(wf); err == nil {
		t.Fatal("expected cycle error")
	}
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

func TestLoadGUIRunWorkflow(t *testing.T) {
	root := findRepoRoot(t)
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.gui-run.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := schema.SemanticValidate(wf); err != nil {
		t.Fatal(err)
	}
	if wf.Steps[0].Action != "run" {
		t.Fatalf("action=%s", wf.Steps[0].Action)
	}
}

func TestLoadInventoryWorkflow(t *testing.T) {
	root := findRepoRoot(t)
	wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", "demo.inventory-create.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if err := schema.SemanticValidate(wf); err != nil {
		t.Fatal(err)
	}
}

func TestLoadFeishuWorkflows(t *testing.T) {
	root := findRepoRoot(t)
	for _, name := range []string{
		"feishu.doctor.yaml",
		"feishu.auth-status.yaml",
		"feishu.send-text.yaml",
		"feishu.calendar-agenda.yaml",
		"feishu.chat-list.yaml",
		"feishu.my-tasks.yaml",
		"feishu.docs-search.yaml",
		"feishu.sheets-cells-get.yaml",
		"feishu.calendar-create.yaml",
	} {
		wf, err := schema.LoadWorkflowFile(filepath.Join(root, "workflows", name))
		if err != nil {
			t.Fatalf("%s load: %v", name, err)
		}
		if err := schema.SemanticValidate(wf); err != nil {
			t.Fatalf("%s validate: %v", name, err)
		}
	}
}
