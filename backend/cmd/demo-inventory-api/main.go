// Demo Inventory REST API for factory-generated HTTP CLIs.
// Matches examples/cli-factory/demo-inventory.openapi.yaml
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

func main() {
	addr := envOr("DEMO_INVENTORY_API_ADDR", "127.0.0.1:8795")
	store := &itemStore{items: map[string]map[string]any{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "demo-inventory-api"})
	})
	mux.HandleFunc("GET /items", store.list)
	mux.HandleFunc("POST /items", store.create)
	mux.HandleFunc("GET /items/{id}", store.get)
	fmt.Fprintf(os.Stderr, "[demo-inventory-api] listening on http://%s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

type itemStore struct {
	mu    sync.Mutex
	items map[string]map[string]any
}

func (s *itemStore) list(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]map[string]any, 0, len(s.items))
	for _, v := range s.items {
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (s *itemStore) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.items[id]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *itemStore) create(w http.ResponseWriter, r *http.Request) {
	var item map[string]any
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}
	id, _ := item["id"].(string)
	if id == "" {
		id = fmt.Sprintf("item-%d", time.Now().UnixNano())
		item["id"] = id
	}
	item["status"] = "created"
	item["createdAt"] = time.Now().UTC().Format(time.RFC3339)
	s.mu.Lock()
	s.items[id] = item
	s.mu.Unlock()
	writeJSON(w, http.StatusCreated, item)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func envOr(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}
