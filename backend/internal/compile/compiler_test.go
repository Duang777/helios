package compile_test

import (
	"context"
	"strings"
	"testing"

	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/pi"
)

type fakeDrafter struct {
	calls int
}

func (f *fakeDrafter) Draft(_ context.Context, in pi.DraftRequest) (pi.DraftResponse, error) {
	f.calls++
	if f.calls == 1 || strings.TrimSpace(in.PreviousYAML) == "" {
		return pi.DraftResponse{
			YAML: `kind: Workflow
id: broken.draft
version: 1
steps:
  - id: noop
    uses: approval
    prompt: "x"
`,
			Mode:       "mock",
			RawTraceID: "t1",
		}, nil
	}
	return pi.DraftResponse{
		YAML: `apiVersion: helios/v1
kind: Workflow
id: fixed.draft
version: 1
description: repaired
params: {}
steps:
  - id: approve
    uses: approval
    prompt: "ok?"
`,
		Mode:       "mock",
		RawTraceID: "t2",
	}, nil
}

func TestCompileRepairLoop(t *testing.T) {
	d := &fakeDrafter{}
	c := compile.New(d, func() ([]pi.CLISummary, error) {
		return []pi.CLISummary{}, nil
	})
	res, err := c.Compile(context.Background(), compile.Request{Intent: "anything"})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Validation.OK {
		t.Fatalf("expected validation ok, errors=%v", res.Validation.Errors)
	}
	if res.Workflow == nil || res.Workflow.ID != "fixed.draft" {
		t.Fatalf("unexpected workflow: %+v", res.Workflow)
	}
	if d.calls != 2 {
		t.Fatalf("expected 2 draft calls, got %d", d.calls)
	}
	if len(res.Attempts) != 2 {
		t.Fatalf("expected 2 attempts, got %d", len(res.Attempts))
	}
}

func TestCompileRequiresIntent(t *testing.T) {
	c := compile.New(&fakeDrafter{}, func() ([]pi.CLISummary, error) { return nil, nil })
	_, err := c.Compile(context.Background(), compile.Request{})
	if err == nil {
		t.Fatal("expected error")
	}
}
