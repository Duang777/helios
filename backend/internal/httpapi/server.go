package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/Duang777/helios/backend/internal/compiler"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/store"
)

type Server struct {
	compiler *compiler.Compiler
	runtime  *runtime.Runtime
	store    *store.MemoryStore
}

func NewServer(c *compiler.Compiler, r *runtime.Runtime, s *store.MemoryStore) *Server {
	return &Server{compiler: c, runtime: r, store: s}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/runtime/adapters", s.handleRuntimeAdapters)
	mux.HandleFunc("POST /api/workflows/compile", s.handleCompile)
	mux.HandleFunc("POST /api/workflows/", s.handleWorkflowAction)
	mux.HandleFunc("GET /api/runs/", s.handleGetRun)
	return cors(mux)
}

type compileRequest struct {
	Goal string `json:"goal"`
}

type compileResponse struct {
	Workflow any `json:"workflow"`
}

type runResponse struct {
	Run any `json:"run"`
}

type adaptersResponse struct {
	Adapters any `json:"adapters"`
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "helios"})
}

func (s *Server) handleRuntimeAdapters(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, adaptersResponse{Adapters: s.runtime.AdapterStatuses()})
}

func (s *Server) handleCompile(w http.ResponseWriter, r *http.Request) {
	var req compileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}

	workflow, err := s.compiler.Compile(req.Goal)
	if err != nil {
		if errors.Is(err, compiler.ErrEmptyGoal) {
			writeError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "goal is required")
			return
		}
		writeError(w, http.StatusInternalServerError, "COMPILE_FAILED", "workflow compilation failed")
		return
	}

	s.store.SaveWorkflow(workflow)
	writeJSON(w, http.StatusCreated, compileResponse{Workflow: workflow})
}

func (s *Server) handleWorkflowAction(w http.ResponseWriter, r *http.Request) {
	workflowID, action, ok := parseWorkflowAction(r.URL.Path)
	if !ok || action != "runs" {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow action not found")
		return
	}

	workflow, err := s.store.GetWorkflow(workflowID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}

	run, err := s.runtime.Run(workflow)
	if err != nil {
		s.store.SaveRun(run)
		writeJSON(w, http.StatusCreated, runResponse{Run: run})
		return
	}

	s.store.SaveRun(run)
	writeJSON(w, http.StatusCreated, runResponse{Run: run})
}

func (s *Server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	runID := strings.TrimPrefix(r.URL.Path, "/api/runs/")
	if runID == "" {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "run not found")
		return
	}

	run, err := s.store.GetRun(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "run not found")
		return
	}

	writeJSON(w, http.StatusOK, runResponse{Run: run})
}

func parseWorkflowAction(path string) (workflowID string, action string, ok bool) {
	rest := strings.TrimPrefix(path, "/api/workflows/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
