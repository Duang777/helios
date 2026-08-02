package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/manifest"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/scheduler"
	"github.com/Duang777/helios/backend/internal/schema"
	"github.com/Duang777/helios/backend/internal/store"
)

type Server struct {
	store                       *store.FS
	registry                    *registry.Registry
	scheduler                   scheduler.RunScheduler
	compiler                    *compile.Compiler
	workflowSrc                 string // HELIOS_WORKFLOW_SRC — repo root for folder import (U2)
	communityMcpRegistryBaseURL string
	schedulerName               string // inprocess | hatchet (reported on /health)
}

func NewServer(st *store.FS, reg *registry.Registry, sched scheduler.RunScheduler, compiler *compile.Compiler) *Server {
	return &Server{store: st, registry: reg, scheduler: sched, compiler: compiler, schedulerName: scheduler.NameInProcess}
}

// WithWorkflowSrc sets the trusted root for POST .../import-folder (Output-style dirs).
func (s *Server) WithWorkflowSrc(dir string) *Server {
	s.workflowSrc = strings.TrimSpace(dir)
	return s
}

// WithSchedulerName sets the name returned by GET /api/v1/health (for desktop/status).
func (s *Server) WithSchedulerName(name string) *Server {
	if strings.TrimSpace(name) != "" {
		s.schedulerName = strings.TrimSpace(strings.ToLower(name))
	}
	return s
}

// WithCommunityMcpRegistryBaseURL overrides the upstream MCP registry endpoint used for
// community connector discovery. Tests can point this at a local httptest server.
func (s *Server) WithCommunityMcpRegistryBaseURL(rawURL string) *Server {
	if strings.TrimSpace(rawURL) != "" {
		s.communityMcpRegistryBaseURL = strings.TrimSpace(rawURL)
	}
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/v1/health", s.handleHealth)
	mux.HandleFunc("POST /api/v1/compile", s.handleCompile)
	mux.HandleFunc("POST /api/v1/workflows/validate", s.handleValidate)
	mux.HandleFunc("PUT /api/v1/workflows/{id}", s.handleSaveWorkflow)
	mux.HandleFunc("POST /api/v1/workflows/{id}/import-folder", s.handleImportFolder)
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
	mux.HandleFunc("GET /api/v1/runs/{runId}/files/{path...}", s.handleRunFile)
	mux.HandleFunc("GET /api/v1/clis", s.handleListCLIs)
	mux.HandleFunc("POST /api/v1/clis/register", s.handleRegisterCLI)
	mux.HandleFunc("GET /api/v1/mcp-registry/servers", s.handleListCommunityMcpServers)
	return cors(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":    "ok",
		"service":   "helios",
		"scheduler": s.schedulerName,
	})
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

// handleImportFolder loads HELIOS_WORKFLOW_SRC/{id}/ (Output-style) into the runtime store.
func (s *Server) handleImportFolder(w http.ResponseWriter, r *http.Request) {
	if s.workflowSrc == "" {
		writeError(w, http.StatusServiceUnavailable, "WORKFLOW_SRC_UNSET", "set HELIOS_WORKFLOW_SRC to enable folder import")
		return
	}
	id := r.PathValue("id")
	if id == "" || strings.Contains(id, "..") || strings.ContainsAny(id, `/\`) {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "invalid workflow id")
		return
	}
	dir := filepath.Join(s.workflowSrc, id)
	wf, err := s.store.ImportWorkflowDir(dir)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "IMPORT_FAILED", err.Error())
		return
	}
	if wf.ID != id {
		writeError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "workflow id mismatch")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workflow": wf, "importedFrom": dir})
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
	path, err := s.store.WorkflowYAMLPath(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "workflow not found")
		return
	}
	raw, err := os.ReadFile(path)
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
	run, err := s.scheduler.Start(context.Background(), wf, req.Params)
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
	run, err := s.scheduler.Start(context.Background(), wf, params)
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
	if err := s.scheduler.Approve(r.PathValue("runId"), req.StepID, req.Decision, req.Actor); err != nil {
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
	if err := s.scheduler.ResolveHumanHelp(r.Context(), r.PathValue("runId"), req.StepID, *req.OK, req.Note, req.Actor); err != nil {
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
	if err := s.scheduler.Abort(r.PathValue("runId")); err != nil {
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

func (s *Server) handleRunFile(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("runId")
	rel := r.PathValue("path")
	if runID == "" || rel == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "runId and path are required")
		return
	}
	if _, err := s.store.GetRun(runID); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "run not found")
		return
	}
	abs, err := safeRunFile(s.store.RunDir(runID), rel)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", err.Error())
		return
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "file not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "READ_FAILED", err.Error())
		return
	}
	ctype := contentTypeFor(abs)
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func safeRunFile(runDir, rel string) (string, error) {
	cleanRel := filepath.Clean("/" + rel)
	cleanRel = strings.TrimPrefix(cleanRel, "/")
	if cleanRel == "" || cleanRel == "." {
		return "", fmt.Errorf("empty path")
	}
	if strings.HasPrefix(cleanRel, "..") {
		return "", fmt.Errorf("path escapes run directory")
	}
	abs := filepath.Join(runDir, cleanRel)
	abs = filepath.Clean(abs)
	root := filepath.Clean(runDir)
	sep := string(os.PathSeparator)
	if abs != root && !strings.HasPrefix(abs, root+sep) {
		return "", fmt.Errorf("path escapes run directory")
	}
	return abs, nil
}

func contentTypeFor(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".json":
		return "application/json; charset=utf-8"
	case ".html":
		return "text/html; charset=utf-8"
	default:
		return "text/plain; charset=utf-8"
	}
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
