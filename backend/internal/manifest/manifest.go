package manifest

import (
	"fmt"

	"github.com/Duang777/helios/backend/internal/domain"
)

func Build(wf domain.Workflow) domain.Manifest {
	level := domain.SideEffectNone
	requiresApprovals := false
	clis := make([]string, 0, len(wf.Requires.CLIs))
	seenCLI := map[string]struct{}{}

	for _, c := range wf.Requires.CLIs {
		if _, ok := seenCLI[c.Name]; ok {
			continue
		}
		seenCLI[c.Name] = struct{}{}
		clis = append(clis, c.Name)
	}

	for _, step := range wf.Steps {
		if step.Uses == domain.StepUsesApproval {
			requiresApprovals = true
		}
		if step.Uses == domain.StepUsesCLI {
			if _, ok := seenCLI[step.CLI]; !ok && step.CLI != "" {
				seenCLI[step.CLI] = struct{}{}
				clis = append(clis, step.CLI)
			}
			level = maxSideEffect(level, step.SideEffect)
			if step.SideEffect == domain.SideEffectWrite {
				requiresApprovals = true
			}
		}
	}

	title := wf.Description
	if title == "" {
		title = wf.ID
	}

	params := wf.Params
	if params == nil {
		params = map[string]domain.Param{}
	}

	return domain.Manifest{
		ID:                wf.ID,
		Version:           wf.Version,
		Title:             title,
		Params:            params,
		SideEffectLevel:   level,
		RequiresApprovals: requiresApprovals,
		CLIs:              clis,
	}
}

func FilterParams(m domain.Manifest, params map[string]any) (map[string]any, error) {
	if params == nil {
		params = map[string]any{}
	}
	out := map[string]any{}
	for k, v := range params {
		if _, ok := m.Params[k]; !ok {
			return nil, fmt.Errorf("param %q is not in published manifest", k)
		}
		out[k] = v
	}
	for name, spec := range m.Params {
		if !spec.Required {
			continue
		}
		if _, ok := out[name]; !ok {
			return nil, fmt.Errorf("required manifest param %q missing", name)
		}
	}
	return out, nil
}

func maxSideEffect(a, b domain.SideEffect) domain.SideEffect {
	rank := map[domain.SideEffect]int{
		domain.SideEffectNone:  0,
		domain.SideEffectRead:  1,
		domain.SideEffectWrite: 2,
	}
	if rank[b] > rank[a] {
		return b
	}
	return a
}
