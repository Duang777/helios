package evidence

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Duang777/helios/backend/internal/domain"
)

func TestWriteGUI_StoresPNGAndMeta(t *testing.T) {
	dir := t.TempDir()
	st, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a} // PNG magic only for test
	ev := domain.Evidence{
		ID:        "ev_test",
		RunID:     "run_1",
		StepID:    "gui_confirm",
		Type:      "gui",
		StartedAt: time.Now().UTC(),
		EndedAt:   time.Now().UTC(),
		Status:    domain.StepStatusCompleted,
		InputSummary: map[string]any{
			"action": "screenshot_and_confirm",
			"url":    "http://127.0.0.1:8792/fixture/confirm.html",
		},
	}
	written, err := st.WriteGUI(ev, png)
	if err != nil {
		t.Fatal(err)
	}
	if written.ScreenshotRef == "" {
		t.Fatal("expected ScreenshotRef")
	}
	if filepath.Ext(written.ScreenshotRef) != ".png" {
		t.Fatalf("expected .png ref, got %q", written.ScreenshotRef)
	}
	raw, err := os.ReadFile(filepath.Join(dir, written.ScreenshotRef))
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != string(png) {
		t.Fatalf("png bytes mismatch")
	}
	metaPath := filepath.Join(dir, written.ScreenshotRef[:len(written.ScreenshotRef)-4]+".json")
	if _, err := os.Stat(metaPath); err != nil {
		t.Fatalf("meta missing: %v", err)
	}
}
