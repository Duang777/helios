package guiclient

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestScreenshotAndConfirm_DecodesPNG(t *testing.T) {
	png := []byte{0x89, 0x50, 0x4e, 0x47}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/actions/screenshot_and_confirm" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":               true,
			"screenshotBase64": base64.StdEncoding.EncodeToString(png),
			"contentType":      "image/png",
			"mode":             "fake",
		})
	}))
	defer srv.Close()

	c := NewClient(srv.URL)
	out, err := c.ScreenshotAndConfirm(context.Background(), ScreenshotAndConfirmRequest{
		URL:      "http://example/confirm",
		Selector: "button#confirm",
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(out.Screenshot) != string(png) {
		t.Fatalf("png mismatch")
	}
	if out.Mode != "fake" {
		t.Fatalf("mode=%q", out.Mode)
	}
}

func TestScreenshotAndConfirm_RequiresURL(t *testing.T) {
	c := NewClient("http://127.0.0.1:9")
	_, err := c.ScreenshotAndConfirm(context.Background(), ScreenshotAndConfirmRequest{})
	if err == nil {
		t.Fatal("expected error")
	}
}
