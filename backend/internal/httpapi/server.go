package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/manifest"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/schema"
	"github.com/Duang777/helios/backend/internal/store"
)

type Server struct {
	store    *store.FS
	registry *registry.Registry
	engine   *runtime.Engine
	compiler *compile.Compiler
}

func NewServer(st *store.FS, reg *registry.Registry, engine *runtime.Engine, compiler *compile.Compiler) *Server {
	return &Server{store: st, registry: reg, engine: engine, compiler: compiler}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/v1/health", s.handleHealth)
	mux.HandleFunc("POST /api/v1/compile", s.handleCompile)
	mux.HandleFunc("POST /api/v1/workflows/validate", s.handleValidate)
	mux.HandleFunc("PUT /api/v1/workflows/{id}", s.handleSaveWorkflow)
	mux.HandleFunc("GET /api/v1/workflows", s.handleListWorkflows)
	mux.HandleFunc("GET /api/v1/workflows/{id}", s.handleGetWorkflow)
	mux.HandleFunc("GET /api/v1/workflows/{id}/yaml", s.handleGetWorkflowYAML)
	mux.HandleFunc("POST /api/v1/workflows/{id}/runs", s.handleStartRun)
	mux.HandleFunc("POST /api/v1/workflows/{id}/publish", s.handlePublish)
	mux.HandleFunc("GET /api/v1/manifests", s.handleListManifests)
	mux.HandleFunc("GET /api/v1/manifests/{id}", s.handleGetManifest)
	mux.HandleFunc("POST /api/v1/run_workflow", s.handleRunWorkflow)
	mux.HandleFunc("GET /api/v1/runs/{runId}", s.handleGetRun)
	mux.HandleFunc("POST /api/v1/runs/{runId}/approval", s.handleApproval)
	mux.HandleFunc("POST /api/v1/runs/{runId}/human-help", s.handleHumanHelp)
	mux.HandleFunc("POST /api/v1/runs/{runId}/abort", s.handleAbort)
	mux.HandleFunc("GET /api/v1/runs/{runId}/evidence", s.handleEvidence)
	mux.HandleFunc("GET /api/v1/clis", s.handleListCLIs)
	mux.HandleFunc("POST /api/v1/clis/register", s.handleRegisterCLI)
	return cors(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "helios"})
}

type compileRequest struct {
	Intent string         `json:"intent"`
	Hints  map[string]any `json:"hints"`
}

func (s *Server) handleCompile(w http.ResponseWriter, r *http.Request) {
	if s.compiler == nil {
		writeError(w, http.StatusServiceUnavailable, "COMPILE_UNAVAILABLE", "compiler is not configured")
		return
	}
	var req compileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	result, err := s.compiler.Compile(r.Context(), compile.Request{Intent: req.Intent, Hints: req.Hints})
	if err != nil {
		writeError(w, http.StatusBadGateway, "COMPILE_FAILED", err.Error())
		return
	}
	status := http.StatusOK
	if !result.Validation.OK {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, result)
}

func (s *Server) handleValidate(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "unable to read body")
		return
	}
	wf, err := schema.LoadWorkflowYAML(raw)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error())
		return
	}
	if err := schema.SemanticValidate(wf); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "workflow": wf})
}

func (s *Server) handleSaveWorkflow(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_BODY", "unable to read body")
		return
	}
	wf, err := schema.LoadWorkflowYAML(raw)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error())
		return
	}
	if wf.ID != id {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "workflow id mismatch")
		return
	}
	if err := schema.SemanticValidate(wf); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error())
		return
	}
	if err := s.store.SaveWorkflow(wf); err != nil {
		writeError(w, http.StatusInternalServerError, "SAVE_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workflow": wf})
}

func (s *Server) handleListWorkflows(w http.ResponseWriter, _ *http.Request) {
	list, err := s.store.ListWorkflows()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workflows": list})
}

func (s *Server) handleGetWorkflow(w http.ResponseWriter, r *http.Request) {
	wf, err := s.store.GetWorkflow(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workflow": wf})
}

func (s *Server) handleGetWorkflowYAML(w http.ResponseWriter, r *http.Request) {
	raw, err := os.ReadFile(filepath.Join(s.store.Root(), "workflows", r.PathValue("id")+".yaml"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	w.Header().Set("Content-Type", "application/yaml")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

type startRunRequest struct {
	Params map[string]any `json:"params"`
}

func (s *Server) handleStartRun(w http.ResponseWriter, r *http.Request) {
	wf, err := s.store.GetWorkflow(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	var req startRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	run, err := s.engine.Start(context.Background(), wf, req.Params)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "START_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"run": run})
}

func (s *Server) handlePublish(w http.ResponseWriter, r *http.Request) {
	wf, err := s.store.GetWorkflow(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	m := manifest.Build(wf)
	if err := s.store.PublishManifest(m); err != nil {
		writeError(w, http.StatusInternalServerError, "PUBLISH_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"manifest": m})
}

func (s *Server) handleListManifests(w http.ResponseWriter, _ *http.Request) {
	list, err := s.store.ListManifests()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"manifests": list})
}

func (s *Server) handleGetManifest(w http.ResponseWriter, r *http.Request) {
	m, err := s.store.GetManifest(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "manifest not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"manifest": m})
}

type runWorkflowRequest struct {
	ID     string         `json:"id"`
	Params map[string]any `json:"params"`
}

func (s *Server) handleRunWorkflow(w http.ResponseWriter, r *http.Request) {
	var req runWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if req.ID == "" {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "id is required")
		return
	}
	m, err := s.store.GetManifest(req.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_PUBLISHED", "workflow is not published; call publish first")
		return
	}
	wf, err := s.store.GetWorkflow(req.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	params, err := manifest.FilterParams(m, req.Params)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "PARAM_REJECTED", err.Error())
		return
	}
	run, err := s.engine.Start(context.Background(), wf, params)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "START_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"run": run, "manifest": m})
}

func (s *Server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	run, err := s.store.GetRun(r.PathValue("runId"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "run not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": run})
}

type approvalRequest struct {
	StepID   string `json:"stepId"`
	Decision string `json:"decision"`
	Actor    string `json:"actor"`
}

func (s *Server) handleApproval(w http.ResponseWriter, r *http.Request) {
	var req approvalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if req.StepID == "" || req.Decision == "" {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "stepId and decision are required")
		return
	}
	if req.Actor == "" {
		req.Actor = "api"
	}
	if err := s.engine.Approve(r.PathValue("runId"), req.StepID, req.Decision, req.Actor); err != nil {
		writeError(w, http.StatusConflict, "APPROVAL_FAILED", err.Error())
		return
	}
	run, err := s.store.GetRun(r.PathValue("runId"))
	if err != nil {
		writeError(w, http.StatusOK, "OK", "approval submitted")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": run})
}

type humanHelpRequest struct {
	StepID string `json:"stepId"`
	OK     *bool  `json:"ok"`
	Note   string `json:"note"`
	Actor  string `json:"actor"`
}

func (s *Server) handleHumanHelp(w http.ResponseWriter, r *http.Request) {
	var req humanHelpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if req.StepID == "" || req.OK == nil {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "stepId and ok are required")
		return
	}
	if req.Actor == "" {
		req.Actor = "api"
	}
	if err := s.engine.ResolveHumanHelp(r.Context(), r.PathValue("runId"), req.StepID, *req.OK, req.Note, req.Actor); err != nil {
		writeError(w, http.StatusConflict, "HUMAN_HELP_FAILED", err.Error())
		return
	}
	run, err := s.store.GetRun(r.PathValue("runId"))
	if err != nil {
		writeError(w, http.StatusOK, "OK", "human help resolved")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": run})
}

func (s *Server) handleAbort(w http.ResponseWriter, r *http.Request) {
	if err := s.engine.Abort(r.PathValue("runId")); err != nil {
		writeError(w, http.StatusConflict, "ABORT_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleEvidence(w http.ResponseWriter, r *http.Request) {
	run, err := s.store.GetRun(r.PathValue("runId"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "run not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"evidence": run.Evidence, "runDir": s.store.RunDir(run.ID)})
}

type registerCLIRequest struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

func (s *Server) handleRegisterCLI(w http.ResponseWriter, r *http.Request) {
	var req registerCLIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if req.Path == "" {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "path is required")
		return
	}
	rec, err := s.registry.Register(req.Name, req.Path)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "REGISTER_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"cli": rec})
}

func (s *Server) handleListCLIs(w http.ResponseWriter, _ *http.Request) {
	list, err := s.registry.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"clis": list})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{"code": code, "message": message},
	})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
