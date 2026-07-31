package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/schema"
	"gopkg.in/yaml.v3"
)

type FS struct {
	root string
	mu   sync.Mutex
}

func NewFS(root string) (*FS, error) {
	for _, d := range []string{
		filepath.Join(root, "workflows"),
		filepath.Join(root, "runs"),
		filepath.Join(root, "manifests"),
	} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return nil, err
		}
	}
	return &FS{root: root}, nil
}

func (s *FS) Root() string { return s.root }

func (s *FS) SaveWorkflow(wf domain.Workflow) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := schema.SemanticValidate(wf); err != nil {
		return err
	}
	raw, err := yaml.Marshal(wf)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.root, "workflows", wf.ID+".yaml"), raw, 0o644)
}

func (s *FS) GetWorkflow(id string) (domain.Workflow, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return schema.LoadWorkflowFile(filepath.Join(s.root, "workflows", id+".yaml"))
}

func (s *FS) ListWorkflows() ([]domain.Workflow, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "workflows"))
	if err != nil {
		return nil, err
	}
	out := []domain.Workflow{}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".yaml" {
			continue
		}
		wf, err := schema.LoadWorkflowFile(filepath.Join(s.root, "workflows", e.Name()))
		if err != nil {
			return nil, err
		}
		out = append(out, wf)
	}
	return out, nil
}

func (s *FS) SaveRun(run domain.Run) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := filepath.Join(s.root, "runs", run.ID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "run.json"), raw, 0o644)
}

func (s *FS) GetRun(id string) (domain.Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(filepath.Join(s.root, "runs", id, "run.json"))
	if err != nil {
		return domain.Run{}, fmt.Errorf("run not found")
	}
	var run domain.Run
	if err := json.Unmarshal(raw, &run); err != nil {
		return domain.Run{}, err
	}
	return run, nil
}

func (s *FS) RunDir(id string) string {
	return filepath.Join(s.root, "runs", id)
}

func (s *FS) PublishManifest(m domain.Manifest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.root, "manifests", m.ID+".json"), raw, 0o644)
}

func (s *FS) GetManifest(id string) (domain.Manifest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(filepath.Join(s.root, "manifests", id+".json"))
	if err != nil {
		return domain.Manifest{}, fmt.Errorf("manifest not found")
	}
	var m domain.Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return domain.Manifest{}, err
	}
	return m, nil
}

func (s *FS) ListManifests() ([]domain.Manifest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := os.ReadDir(filepath.Join(s.root, "manifests"))
	if err != nil {
		return nil, err
	}
	out := []domain.Manifest{}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(s.root, "manifests", e.Name()))
		if err != nil {
			return nil, err
		}
		var m domain.Manifest
		if err := json.Unmarshal(raw, &m); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}
