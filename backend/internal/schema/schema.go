package schema

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
	"gopkg.in/yaml.v3"
)

func LoadWorkflowFile(path string) (domain.Workflow, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return domain.Workflow{}, err
	}
	return LoadWorkflowYAML(raw)
}

func LoadWorkflowYAML(raw []byte) (domain.Workflow, error) {
	var wf domain.Workflow
	dec := yaml.NewDecoder(bytes.NewReader(raw))
	dec.KnownFields(true)
	if err := dec.Decode(&wf); err != nil {
		return domain.Workflow{}, fmt.Errorf("parse workflow yaml: %w", err)
	}
	if err := StructuralValidate(wf); err != nil {
		return domain.Workflow{}, err
	}
	return wf, nil
}

func StructuralValidate(wf domain.Workflow) error {
	if wf.APIVersion != "helios/v1" {
		return fmt.Errorf("apiVersion must be helios/v1")
	}
	if wf.Kind != "Workflow" {
		return fmt.Errorf("kind must be Workflow")
	}
	if wf.ID == "" {
		return fmt.Errorf("id is required")
	}
	if wf.Version < 1 {
		return fmt.Errorf("version must be >= 1")
	}
	if len(wf.Steps) == 0 {
		return fmt.Errorf("steps must not be empty")
	}
	for _, step := range wf.Steps {
		if step.ID == "" {
			return fmt.Errorf("step id is required")
		}
		switch step.Uses {
		case domain.StepUsesCLI:
			if step.CLI == "" || len(step.Argv) == 0 {
				return fmt.Errorf("step %s: cli steps require cli and argv", step.ID)
			}
		case domain.StepUsesApproval:
			if step.Prompt == "" {
				return fmt.Errorf("step %s: approval steps require prompt", step.ID)
			}
		case domain.StepUsesAI:
			if step.AIPrompt == "" {
				return fmt.Errorf("step %s: ai steps require aiPrompt", step.ID)
			}
		case domain.StepUsesGUI:
			if step.Action == "" {
				return fmt.Errorf("step %s: gui steps require action", step.ID)
			}
			if step.GUI == nil {
				return fmt.Errorf("step %s: gui steps require gui object", step.ID)
			}
			switch step.Action {
			case "run":
				raw, ok := step.GUI["steps"]
				if !ok {
					return fmt.Errorf("step %s: gui.steps is required for action run", step.ID)
				}
				list, ok := raw.([]any)
				if !ok || len(list) == 0 {
					return fmt.Errorf("step %s: gui.steps must be a non-empty list", step.ID)
				}
			default:
				url, _ := step.GUI["url"].(string)
				if strings.TrimSpace(url) == "" {
					return fmt.Errorf("step %s: gui.url is required", step.ID)
				}
			}
		case domain.StepUsesCode:
			// allowed; deeper checks later
		default:
			return fmt.Errorf("step %s: unsupported uses %q", step.ID, step.Uses)
		}
	}
	return nil
}

func SemanticValidate(wf domain.Workflow) error {
	if err := StructuralValidate(wf); err != nil {
		return err
	}

	ids := map[string]struct{}{}
	outs := map[string]string{}
	requiredCLIs := map[string]struct{}{}
	for _, c := range wf.Requires.CLIs {
		requiredCLIs[c.Name] = struct{}{}
	}

	for _, step := range wf.Steps {
		if _, ok := ids[step.ID]; ok {
			return fmt.Errorf("duplicate step id %q", step.ID)
		}
		ids[step.ID] = struct{}{}

		if step.Out != "" {
			if prev, ok := outs[step.Out]; ok {
				return fmt.Errorf("duplicate out %q on steps %s and %s", step.Out, prev, step.ID)
			}
			outs[step.Out] = step.ID
		}

		if step.Uses == domain.StepUsesCLI {
			if len(requiredCLIs) > 0 {
				if _, ok := requiredCLIs[step.CLI]; !ok {
					return fmt.Errorf("step %s: cli %q not listed in requires.clis", step.ID, step.CLI)
				}
			}
		}
	}

	for _, step := range wf.Steps {
		for _, need := range step.Needs {
			if _, ok := ids[need]; !ok {
				return fmt.Errorf("step %s: unknown dependency %q", step.ID, need)
			}
		}
	}

	if err := detectCycle(wf.Steps); err != nil {
		return err
	}

	if !wf.AutoApprove {
		for _, step := range wf.Steps {
			if step.SideEffect == domain.SideEffectWrite && step.Uses == domain.StepUsesCLI {
				if !hasApprovalAncestor(step, wf.Steps) {
					// dry-run writes are still write side effects but OK before approval;
					// require an approval somewhere before this write step in the dependency chain.
					return fmt.Errorf("step %s: write sideEffect requires an approval ancestor (or autoApprove)", step.ID)
				}
			}
		}
	}

	return nil
}

func hasApprovalAncestor(step domain.Step, steps []domain.Step) bool {
	byID := map[string]domain.Step{}
	for _, s := range steps {
		byID[s.ID] = s
	}
	seen := map[string]struct{}{}
	var walk func(string) bool
	walk = func(id string) bool {
		if _, ok := seen[id]; ok {
			return false
		}
		seen[id] = struct{}{}
		s, ok := byID[id]
		if !ok {
			return false
		}
		if s.Uses == domain.StepUsesApproval {
			return true
		}
		for _, need := range s.Needs {
			if walk(need) {
				return true
			}
		}
		return false
	}
	for _, need := range step.Needs {
		if walk(need) {
			return true
		}
	}
	return false
}

func detectCycle(steps []domain.Step) error {
	byID := map[string]domain.Step{}
	for _, s := range steps {
		byID[s.ID] = s
	}
	const (
		white = 0
		gray  = 1
		black = 2
	)
	color := map[string]int{}
	var visit func(string) error
	visit = func(id string) error {
		color[id] = gray
		s := byID[id]
		for _, need := range s.Needs {
			switch color[need] {
			case gray:
				return fmt.Errorf("cycle detected at %s -> %s", id, need)
			case white:
				if err := visit(need); err != nil {
					return err
				}
			}
		}
		color[id] = black
		return nil
	}
	for _, s := range steps {
		if color[s.ID] == white {
			if err := visit(s.ID); err != nil {
				return err
			}
		}
	}
	return nil
}
