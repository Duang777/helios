package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListCommunityMcpServers(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v0.1/servers" {
			http.Error(w, "unexpected path", http.StatusBadRequest)
			return
		}
		if got := r.URL.Query().Get("version"); got != "latest" {
			http.Error(w, "unexpected version", http.StatusBadRequest)
			return
		}
		if got := r.URL.Query().Get("search"); got != "filesystem" {
			http.Error(w, "unexpected search", http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"servers": []map[string]any{
				{
					"server": map[string]any{
						"name":        "com.example/filesystem",
						"title":       "Filesystem",
						"description": "List files",
						"version":     "1.2.3",
						"repository": map[string]any{
							"url": "https://github.com/example/filesystem",
						},
						"websiteUrl": "https://example.com/fs",
						"remotes": []map[string]any{
							{
								"type": "streamable-http",
								"url":  "https://example.com/mcp",
							},
						},
						"packages": []map[string]any{
							{
								"registryType": "npm",
								"identifier":   "filesystem-mcp",
								"version":      "1.2.3",
								"runtimeHint":  "npx",
								"transport": map[string]any{
									"type": "stdio",
								},
								"runtimeArguments": []map[string]any{
									{
										"value": "-y",
										"type":  "positional",
									},
								},
								"environmentVariables": []map[string]any{
									{
										"name":       "FS_ROOT",
										"isRequired": true,
									},
								},
							},
						},
					},
					"_meta": map[string]any{
						"io.modelcontextprotocol.registry/official": map[string]any{
							"status":   "active",
							"isLatest": true,
						},
					},
				},
			},
			"metadata": map[string]any{
				"nextCursor": "abc",
				"count":      1,
			},
		})
	}))
	defer upstream.Close()

	srv := httptest.NewServer(NewServer(nil, nil, nil, nil).WithCommunityMcpRegistryBaseURL(upstream.URL).Handler())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/v1/mcp-registry/servers?search=filesystem&limit=12")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}

	var payload communityMcpCatalogResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Metadata.Count != 1 || payload.Metadata.NextCursor != "abc" {
		t.Fatalf("metadata=%+v", payload.Metadata)
	}
	if len(payload.Servers) != 1 {
		t.Fatalf("servers=%d", len(payload.Servers))
	}
	got := payload.Servers[0]
	if got.Title != "Filesystem" || got.Name != "com.example/filesystem" {
		t.Fatalf("server=%+v", got)
	}
	if got.Transport != "stdio" {
		t.Fatalf("transport=%q", got.Transport)
	}
	if !strings.Contains(got.InstallHint, "npx -y filesystem-mcp@1.2.3") {
		t.Fatalf("installHint=%q", got.InstallHint)
	}
	if !strings.Contains(got.InstallHint, "FS_ROOT") {
		t.Fatalf("installHint=%q", got.InstallHint)
	}
	if got.Status != "active" || !got.IsLatest {
		t.Fatalf("status=%q latest=%v", got.Status, got.IsLatest)
	}
}
