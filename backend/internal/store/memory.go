package store

import (
	"fmt"
	"sync"

	"github.com/Duang777/helios/backend/internal/domain"
)

type MemoryStore struct {
	mu        sync.RWMutex
	workflows map[string]domain.WorkflowTemplate
	runs      map[string]domain.WorkflowRun
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{workflows: map[string]domain.WorkflowTemplate{}, runs: map[string]domain.WorkflowRun{}}
}

func (s *MemoryStore) SaveWorkflow(workflow domain.WorkflowTemplate) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.workflows[workflow.ID] = workflow
}

func (s *MemoryStore) GetWorkflow(id string) (domain.WorkflowTemplate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	wf, ok := s.workflows[id]
	if !ok {
		return domain.WorkflowTemplate{}, fmt.Errorf("workflow %s not found", id)
	}
	return wf, nil
}

func (s *MemoryStore) SaveRun(run domain.WorkflowRun) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.runs[run.ID] = run
}

func (s *MemoryStore) GetRun(id string) (domain.WorkflowRun, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	run, ok := s.runs[id]
	if !ok {
		return domain.WorkflowRun{}, fmt.Errorf("run %s not found", id)
	}
	return run, nil
}
