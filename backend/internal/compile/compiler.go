package compile

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/schema"
)

type Drafter interface {
	Draft(ctx context.Context, in pi.DraftRequest) (pi.DraftResponse, error)
}

type Request struct {
	Intent string         `json:"intent"`
	Hints  map[string]any `json:"hints,omitempty"`
}

type Validation struct {
	OK     bool     `json:"ok"`
	Errors []string `json:"errors"`
}

type Attempt struct {
	YAML       string `json:"yaml"`
	Mode       string `json:"mode,omitempty"`
	Model      string `json:"model,omitempty"`
	RawTraceID string `json:"rawTraceId,omitempty"`
	Error      string `json:"error,omitempty"`
}

type IR struct {
	ID          string             `json:"id"`
	Version     int                `json:"version"`
	Description string             `json:"description,omitempty"`
	Params      map[string]IRParam `json:"params"`
	Steps       []IRStep           `json:"steps"`
}

type IRParam struct {
	Type        string `json:"type"`
	Required    bool   `json:"required,omitempty"`
	Description string `json:"description,omitempty"`
}

type IRStep struct {
	ID         string   `json:"id"`
	Uses       string   `json:"uses"`
	Needs      []string `json:"needs,omitempty"`
	CLI        string   `json:"cli,omitempty"`
	SideEffect string   `json:"sideEffect,omitempty"`
	Prompt     string   `json:"prompt,omitempty"`
}

type Result struct {
	YAML           string           `json:"yaml"`
	Mode           string           `json:"mode,omitempty"`
	Model          string           `json:"model,omitempty"`
	Validation     Validation       `json:"validation"`
	Warnings       []string         `json:"warnings"`
	Attempts       []Attempt        `json:"attempts"`
	RepairAttempts []Attempt        `json:"repairAttempts"`
	IR             *IR              `json:"ir,omitempty"`
	Workflow       *domain.Workflow `json:"workflow,omitempty"`
}

type Compiler struct {
	Drafter     Drafter
	MaxRepairs  int
	CLIProvider func() ([]pi.CLISummary, error)
}

func New(drafter Drafter, cliProvider func() ([]pi.CLISummary, error)) *Compiler {
	return &Compiler{
		Drafter:     drafter,
		MaxRepairs:  2,
		CLIProvider: cliProvider,
	}
}

func (c *Compiler) Compile(ctx context.Context, req Request) (Result, error) {
	if strings.TrimSpace(req.Intent) == "" {
		return Result{}, fmt.Errorf("intent is required")
	}
	clis, err := c.CLIProvider()
	if err != nil {
		return Result{}, err
	}

	var (
		yaml   string
		result = Result{Attempts: []Attempt{}, RepairAttempts: []Attempt{}, Warnings: []string{}}
	)

	maxAttempts := 1 + c.MaxRepairs
	var prevErrors []string
	for attempt := 0; attempt < maxAttempts; attempt++ {
		draftReq := pi.DraftRequest{
			Intent: req.Intent,
			CLIs:   clis,
			Hints:  req.Hints,
		}
		if attempt > 0 {
			draftReq.PreviousYAML = yaml
			draftReq.PreviousErrors = prevErrors
		}
		draft, err := c.Drafter.Draft(ctx, draftReq)
		if err != nil {
			return result, err
		}
		yaml = extractYAML(draft.YAML)
		att := Attempt{YAML: yaml, Mode: draft.Mode, Model: draft.Model, RawTraceID: draft.RawTraceID}
		wf, verr := validateYAML(yaml)
		if verr != nil {
			att.Error = verr.Error()
			result.addAttempt(att)
			prevErrors = []string{verr.Error()}
			continue
		}
		result.addAttempt(att)
		result.YAML = yaml
		result.Mode = draft.Mode
		result.Model = draft.Model
		result.Validation = Validation{OK: true, Errors: []string{}}
		result.Warnings = warningsFor(wf)
		ir := buildIR(wf)
		result.IR = &ir
		result.Workflow = &wf
		return result, nil
	}

	result.YAML = yaml
	if len(result.Attempts) > 0 {
		last := result.Attempts[len(result.Attempts)-1]
		result.Mode = last.Mode
		result.Model = last.Model
	}
	result.Validation = Validation{OK: false, Errors: prevErrors}
	return result, nil
}

func (r *Result) addAttempt(att Attempt) {
	r.Attempts = append(r.Attempts, att)
	r.RepairAttempts = append(r.RepairAttempts, att)
}

func validateYAML(raw string) (domain.Workflow, error) {
	wf, err := schema.LoadWorkflowYAML([]byte(raw))
	if err != nil {
		return domain.Workflow{}, err
	}
	if err := schema.SemanticValidate(wf); err != nil {
		return domain.Workflow{}, err
	}
	return wf, nil
}

func warningsFor(wf domain.Workflow) []string {
	var out []string
	hasApproval := false
	for _, step := range wf.Steps {
		if step.Uses == domain.StepUsesApproval {
			hasApproval = true
		}
	}
	for _, step := range wf.Steps {
		if step.Uses == domain.StepUsesCLI && step.SideEffect == domain.SideEffectWrite && !hasApproval {
			out = append(out, fmt.Sprintf("step %s is write; no approval step present", step.ID))
		}
	}
	return out
}

func buildIR(wf domain.Workflow) IR {
	params := make(map[string]IRParam, len(wf.Params))
	for name, param := range wf.Params {
		params[name] = IRParam{
			Type:        param.Type,
			Required:    param.Required,
			Description: param.Description,
		}
	}

	steps := make([]IRStep, 0, len(wf.Steps))
	for _, step := range wf.Steps {
		steps = append(steps, IRStep{
			ID:         step.ID,
			Uses:       string(step.Uses),
			Needs:      step.Needs,
			CLI:        step.CLI,
			SideEffect: string(step.SideEffect),
			Prompt:     step.Prompt,
		})
	}

	return IR{
		ID:          wf.ID,
		Version:     wf.Version,
		Description: wf.Description,
		Params:      params,
		Steps:       steps,
	}
}

var fenceRe = regexp.MustCompile("(?is)```(?:ya?ml)?\\s*(.*?)```")

func extractYAML(text string) string {
	text = strings.TrimSpace(text)
	if m := fenceRe.FindStringSubmatch(text); len(m) == 2 {
		return strings.TrimSpace(m[1]) + "\n"
	}
	return text + "\n"
}

func SummarizeCLIs(recs []domain.RegisteredCLI) []pi.CLISummary {
	out := make([]pi.CLISummary, 0, len(recs))
	for _, rec := range recs {
		sum := pi.CLISummary{Name: rec.Name, Version: rec.Version}
		for _, cmd := range rec.Introspect.Commands {
			sum.Commands = append(sum.Commands, pi.CommandSummary{
				Path:       cmd.Path,
				SideEffect: string(cmd.SideEffect),
			})
		}
		out = append(out, sum)
	}
	return out
}
