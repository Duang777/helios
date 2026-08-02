package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Duang777/helios/backend/internal/clirunner"
	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/httpapi"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/store"
)

type contractDrafter struct{}

func (contractDrafter) Draft(context.Context, pi.DraftRequest) (pi.DraftResponse, error) {
	return pi.DraftResponse{
		YAML: `apiVersion: helios/v1
kind: Workflow
id: contract.draft
version: 1
params: {}
steps:
  - id: approve
    uses: approval
    prompt: "ok?"
`,
		Mode:       "mock",
		RawTraceID: "contract-trace",
	}, nil
}

func TestCompileReturnsDesktopStudioContract(t *testing.T) {
	dataDir := t.TempDir()
	reg, err := registry.New(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	st, err := store.NewFS(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	compiler := compile.New(contractDrafter{}, func() ([]pi.CLISummary, error) {
		return nil, nil
	})
	engine := runtime.NewEngine(st, clirunner.New(reg))
	srv := httptest.NewServer(httpapi.NewServer(st, reg, engine, compiler).Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]any{"intent": "draft an approval workflow"})
	resp, err := http.Post(srv.URL+"/api/v1/compile", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result["yaml"] == "" {
		t.Fatalf("missing yaml: %+v", result)
	}
	if result["validation"].(map[string]any)["ok"] != true {
		t.Fatalf("validation=%+v", result["validation"])
	}
	if _, ok := result["repairAttempts"].([]any); !ok {
		t.Fatalf("missing repairAttempts: %+v", result)
	}
	ir, ok := result["ir"].(map[string]any)
	if !ok {
		t.Fatalf("missing ir: %+v", result)
	}
	if ir["id"] != "contract.draft" {
		t.Fatalf("ir=%+v", ir)
	}
}
