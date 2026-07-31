package pi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDraft_ParsesMode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/compile" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"yaml":       "apiVersion: helios/v1\nkind: Workflow\nid: x\nversion: 1\nparams: {}\nsteps:\n  - id: a\n    uses: approval\n    prompt: p\n",
			"mode":       "mock",
			"rawTraceId": "t1",
		})
	}))
	defer srv.Close()
	c := NewClient(srv.URL)
	out, err := c.Draft(context.Background(), DraftRequest{Intent: "x", CLIs: nil})
	if err != nil {
		t.Fatal(err)
	}
	if out.Mode != "mock" || out.YAML == "" {
		t.Fatalf("%+v", out)
	}
}

func TestAIStep_NoBlindRetry(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(500)
		_, _ = w.Write([]byte(`{"error":"boom"}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL)
	_, err := c.AIStep(context.Background(), AIStepRequest{Prompt: "x"})
	if err == nil {
		t.Fatal("expected error")
	}
	if calls != 1 {
		t.Fatalf("expected single call, got %d", calls)
	}
}
