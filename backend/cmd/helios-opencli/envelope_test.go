package main

import (
	"encoding/json"
	"testing"
)

func TestWrapOutputJSONArray(t *testing.T) {
	out := wrapOutput("hackernews top", []byte(`[{"rank":1,"title":"x"}]`), nil, 0)
	if out["ok"] != true {
		t.Fatalf("ok: %#v", out["ok"])
	}
	raw, _ := json.Marshal(out["data"])
	if string(raw) != `[{"rank":1,"title":"x"}]` {
		t.Fatalf("data: %s", raw)
	}
}

func TestWrapOutputRawText(t *testing.T) {
	out := wrapOutput("list", []byte("not-json"), nil, 0)
	data, _ := out["data"].(map[string]any)
	if data["raw"] != "not-json" {
		t.Fatalf("data: %#v", data)
	}
}

func TestWrapOutputFailure(t *testing.T) {
	out := wrapOutput("doctor", nil, []byte("bridge down"), 1)
	if out["ok"] != false {
		t.Fatalf("ok: %#v", out)
	}
	if out["error"] != "bridge down" {
		t.Fatalf("error: %#v", out["error"])
	}
}
