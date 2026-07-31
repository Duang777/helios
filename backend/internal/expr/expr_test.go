package expr

import (
	"testing"
)

func TestEvalString_ParamsAndNestedFields(t *testing.T) {
	scope := Scope{
		Params: map[string]any{"lead_id": "L-123"},
		Vars: map[string]any{
			"lead": map[string]any{
				"ok": true,
				"data": map[string]any{
					"id":    "L-123",
					"title": "Acme deal",
				},
			},
		},
	}

	got, err := EvalString("lead=${params.lead_id}", scope)
	if err != nil {
		t.Fatalf("EvalString: %v", err)
	}
	if got != "lead=L-123" {
		t.Fatalf("got %q", got)
	}

	got, err = EvalString("${lead.data}", scope)
	if err != nil {
		t.Fatalf("EvalString object: %v", err)
	}
	if got != `{"id":"L-123","title":"Acme deal"}` {
		t.Fatalf("got %q", got)
	}
}

func TestEvalBool_WhenExpressions(t *testing.T) {
	scope := Scope{
		Vars: map[string]any{
			"po": map[string]any{"needs_gui": true, "confirmUrl": "https://example.com"},
		},
	}

	ok, err := EvalBool("${po.needs_gui} == true", scope)
	if err != nil || !ok {
		t.Fatalf("expected true, err=%v ok=%v", err, ok)
	}

	ok, err = EvalBool(`${po.confirmUrl} != ""`, scope)
	if err != nil || !ok {
		t.Fatalf("expected non-empty true, err=%v ok=%v", err, ok)
	}

	ok, err = EvalBool("false", scope)
	if err != nil || ok {
		t.Fatalf("expected false literal")
	}
}

func TestEvalString_UnknownVar(t *testing.T) {
	_, err := EvalString("${missing}", Scope{})
	if err == nil {
		t.Fatal("expected error")
	}
}
