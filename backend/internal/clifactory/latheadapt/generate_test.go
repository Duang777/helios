package latheadapt_test

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Duang777/helios/backend/internal/clifactory/latheadapt"
	"github.com/Duang777/helios/backend/internal/domain"
)

func TestGenerate_LatheInventory(t *testing.T) {
	if _, err := exec.LookPath("lathe"); err != nil {
		t.Skip("lathe not installed: " + latheadapt.InstallHint)
	}
	root := findRepoRoot(t)
	out := filepath.Join(root, "backend", ".tmp-lathe-factory-test")
	_ = os.RemoveAll(out)
	t.Cleanup(func() { _ = os.RemoveAll(out) })

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	res, err := latheadapt.Generate(ctx, latheadapt.GenerateOptions{
		Name:        "demo-inv-lathe",
		OpenAPIPath: filepath.Join(root, "examples", "cli-factory", "demo-inventory.openapi.yaml"),
		OutDir:      out,
		ModulePath:  "github.com/Duang777/helios/backend/.tmp-lathe-factory-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(res.LatheBinary); err != nil {
		t.Fatal(err)
	}
	wrapBin := filepath.Join(out, "bin", "demo-inv-lathe")
	build := exec.Command("go", "build", "-o", wrapBin, "./helios-wrap")
	build.Dir = out
	if outb, err := build.CombinedOutput(); err != nil {
		t.Fatalf("wrap build: %v\n%s", err, outb)
	}
	introOut, err := exec.Command(wrapBin, "introspect").Output()
	if err != nil {
		t.Fatal(err)
	}
	var intro domain.CLIIntrospect
	if err := json.Unmarshal(introOut, &intro); err != nil {
		t.Fatal(err)
	}
	if intro.Name != "demo-inv-lathe" || len(intro.Commands) < 2 {
		t.Fatalf("introspect=%+v", intro)
	}
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := wd
	for i := 0; i < 8; i++ {
		if _, err := os.Stat(filepath.Join(dir, "examples/cli-factory/demo-inventory.openapi.yaml")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("repo root not found")
	return ""
}
