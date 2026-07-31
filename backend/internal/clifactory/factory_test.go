package clifactory_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/Duang777/helios/backend/internal/clifactory"
	"github.com/Duang777/helios/backend/internal/domain"
)

func TestFromOpenAPI_DemoInventory(t *testing.T) {
	root := findRepoRoot(t)
	spec, err := clifactory.FromOpenAPIFile(
		filepath.Join(root, "examples/cli-factory/demo-inventory.openapi.yaml"),
		"demo-inventory",
	)
	if err != nil {
		t.Fatal(err)
	}
	if spec.Name != "demo-inventory" {
		t.Fatalf("name=%s", spec.Name)
	}
	paths := map[string]string{}
	for _, c := range spec.Commands {
		paths[join(c.Path)] = c.Handler
	}
  if paths["items get"] != "httpGet" || paths["items list"] != "httpList" || paths["items create"] != "httpCreate" {
		t.Fatalf("commands=%v baseUrl=%q", paths, spec.BaseURL)
	}
	if spec.BaseURL != "http://127.0.0.1:8795" {
		t.Fatalf("baseUrl=%s", spec.BaseURL)
	}
}

func TestGenerate_BuildAndIntrospect(t *testing.T) {
	root := findRepoRoot(t)
	spec, err := clifactory.LoadSpecFile(filepath.Join(root, "examples/cli-factory/demo-inventory.factory.json"))
	if err != nil {
		t.Fatal(err)
	}
	outDir := filepath.Join(root, "backend", ".tmp-factory-test", "demo-inventory")
	_ = os.RemoveAll(outDir)
	t.Cleanup(func() { _ = os.RemoveAll(filepath.Join(root, "backend", ".tmp-factory-test")) })
	if _, err := clifactory.Generate(spec, outDir); err != nil {
		t.Fatal(err)
	}
	bin := filepath.Join(t.TempDir(), "demo-inventory")
	cmd := exec.Command("go", "build", "-o", bin, "./.tmp-factory-test/demo-inventory")
	cmd.Dir = filepath.Join(root, "backend")
	cmd.Env = append(os.Environ(), "GOTOOLCHAIN=auto")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	introOut, err := exec.Command(bin, "introspect").Output()
	if err != nil {
		t.Fatal(err)
	}
	var intro domain.CLIIntrospect
	if err := json.Unmarshal(introOut, &intro); err != nil {
		t.Fatal(err)
	}
	if intro.Name != "demo-inventory" || intro.Version == "" || len(intro.Commands) < 4 {
		t.Fatalf("introspect=%+v", intro)
	}
	// dry-run create
	create := exec.Command(bin, "items", "create", "--from-json", `{"id":"SKU-1","title":"Widget"}`, "--dry-run")
	out, err := create.CombinedOutput()
	if err == nil {
		t.Fatal("expected exit 9")
	}
	if ee, ok := err.(*exec.ExitError); !ok || ee.ExitCode() != 9 {
		t.Fatalf("exit=%v out=%s", err, out)
	}
}

func TestLoadFactoryExample(t *testing.T) {
	root := findRepoRoot(t)
	spec, err := clifactory.LoadSpecFile(filepath.Join(root, "examples/cli-factory/demo-inventory.factory.json"))
	if err != nil {
		t.Fatal(err)
	}
	intro := spec.ToIntrospect()
	if intro.Name != "demo-inventory" {
		t.Fatal(intro.Name)
	}
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " "
		}
		out += p
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
		if _, err := os.Stat(filepath.Join(dir, "examples/cli-factory/demo-inventory.factory.json")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("repo root not found")
	return ""
}
