package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Duang777/helios/backend/internal/compiler"
	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/store"
)

func TestCompileAndRunWorkflow(t *testing.T) {
	server := NewServer(compiler.New(), runtime.New(), store.NewMemoryStore())
	handler := server.Handler()

	compileReq := httptest.NewRequest(http.MethodPost, "/api/workflows/compile", bytes.NewBufferString(`{"goal":"名创优品新品开发智能决策引擎"}`))
	compileReq.Header.Set("Content-Type", "application/json")
	compileResp := httptest.NewRecorder()
	handler.ServeHTTP(compileResp, compileReq)

	if compileResp.Code != http.StatusCreated {
		t.Fatalf("compile status = %d, want 201, body %s", compileResp.Code, compileResp.Body.String())
	}

	var compiled struct {
		Workflow struct {
			ID string `json:"id"`
		} `json:"workflow"`
	}
	if err := json.Unmarshal(compileResp.Body.Bytes(), &compiled); err != nil {
		t.Fatalf("decode compile response: %v", err)
	}

	runReq := httptest.NewRequest(http.MethodPost, "/api/workflows/"+compiled.Workflow.ID+"/runs", nil)
	runResp := httptest.NewRecorder()
	handler.ServeHTTP(runResp, runReq)

	if runResp.Code != http.StatusCreated {
		t.Fatalf("run status = %d, want 201, body %s", runResp.Code, runResp.Body.String())
	}
}

func TestListRuntimeAdapters(t *testing.T) {
	server := NewServer(compiler.New(), runtime.NewWithAdapters(runtime.StaticAdapterRegistry(map[string]domain.AdapterStatus{
		"codex_runtime": {ID: "codex_runtime", Label: "Codex Runtime", Kind: "model", Available: false, Reason: "missing config"},
		"local_tools":   {ID: "local_tools", Label: "Local Tools", Kind: "tool", Available: true, Reason: "available"},
	})), store.NewMemoryStore())
	handler := server.Handler()

	req := httptest.NewRequest(http.MethodGet, "/api/runtime/adapters", nil)
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body %s", resp.Code, resp.Body.String())
	}

	var payload struct {
		Adapters []domain.AdapterStatus `json:"adapters"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Adapters) != 2 {
		t.Fatalf("adapters = %d, want 2", len(payload.Adapters))
	}
	if payload.Adapters[0].ID != "codex_runtime" || payload.Adapters[0].Available {
		t.Fatalf("first adapter = %+v, want unavailable codex_runtime", payload.Adapters[0])
	}
}

func TestRunUnavailableAdapterReturnsFailedRun(t *testing.T) {
	server := NewServer(compiler.New(), runtime.NewWithAdapters(runtime.StaticAdapterRegistry(map[string]domain.AdapterStatus{
		"router":        {ID: "router", Label: "Router", Available: true},
		"codex_runtime": {ID: "codex_runtime", Label: "Codex Runtime", Available: false, Reason: "missing config"},
	})), store.NewMemoryStore())
	handler := server.Handler()

	compileReq := httptest.NewRequest(http.MethodPost, "/api/workflows/compile", bytes.NewBufferString(`{"goal":"接入 Codex Runtime、Claude 和本地工具，编排一个 AI 工作流"}`))
	compileReq.Header.Set("Content-Type", "application/json")
	compileResp := httptest.NewRecorder()
	handler.ServeHTTP(compileResp, compileReq)

	var compiled struct {
		Workflow struct {
			ID string `json:"id"`
		} `json:"workflow"`
	}
	if err := json.Unmarshal(compileResp.Body.Bytes(), &compiled); err != nil {
		t.Fatalf("decode compile response: %v", err)
	}

	runReq := httptest.NewRequest(http.MethodPost, "/api/workflows/"+compiled.Workflow.ID+"/runs", nil)
	runResp := httptest.NewRecorder()
	handler.ServeHTTP(runResp, runReq)

	if runResp.Code != http.StatusCreated {
		t.Fatalf("run status = %d, want 201, body %s", runResp.Code, runResp.Body.String())
	}

	var payload struct {
		Run domain.WorkflowRun `json:"run"`
	}
	if err := json.Unmarshal(runResp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode run response: %v", err)
	}
	if payload.Run.Status != domain.RunStatusFailed {
		t.Fatalf("run status = %s, want FAILED", payload.Run.Status)
	}
	if len(payload.Run.NodeRuns) != 2 || payload.Run.NodeRuns[1].Error == "" {
		t.Fatalf("failed node run missing error: %+v", payload.Run.NodeRuns)
	}
}
