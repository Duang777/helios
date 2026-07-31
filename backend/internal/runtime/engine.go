package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Duang777/helios/backend/internal/clirunner"
	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/evidence"
	"github.com/Duang777/helios/backend/internal/expr"
	"github.com/Duang777/helios/backend/internal/guiclient"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/store"
)

type AIRunner interface {
	AIStep(ctx context.Context, in pi.AIStepRequest) (pi.AIStepResponse, error)
}

type GUIRunner interface {
	ScreenshotAndConfirm(ctx context.Context, in guiclient.ScreenshotAndConfirmRequest) (guiclient.ScreenshotAndConfirmResponse, error)
	StartHumanHelp(ctx context.Context, in guiclient.HumanHelpStartRequest) (guiclient.HumanHelpStartResponse, error)
	ResolveHumanHelp(ctx context.Context, in guiclient.HumanHelpResolveRequest) error
}

type Engine struct {
	store  *store.FS
	runner *clirunner.Runner
	ai     AIRunner
	gui    GUIRunner
	now    func() time.Time

	mu        sync.Mutex
	approvals map[string]chan approvalDecision // key: runID/stepID
	humanHelp map[string]*humanHelpWait        // key: runID/stepID
	cancel    map[string]context.CancelFunc
}

type approvalDecision struct {
	Decision string
	Actor    string
}

type humanHelpWait struct {
	HelpID string
	ch     chan humanHelpDecision
}

type humanHelpDecision struct {
	OK    bool
	Note  string
	Actor string
}

func NewEngine(st *store.FS, runner *clirunner.Runner) *Engine {
	return &Engine{
		store:     st,
		runner:    runner,
		now:       time.Now,
		approvals: map[string]chan approvalDecision{},
		humanHelp: map[string]*humanHelpWait{},
		cancel:    map[string]context.CancelFunc{},
	}
}

func (e *Engine) WithAI(ai AIRunner) *Engine {
	e.ai = ai
	return e
}

func (e *Engine) WithGUI(gui GUIRunner) *Engine {
	e.gui = gui
	return e
}

func (e *Engine) Start(ctx context.Context, wf domain.Workflow, params map[string]any) (domain.Run, error) {
	if err := validateParams(wf, params); err != nil {
		return domain.Run{}, err
	}
	run := domain.Run{
		ID:          "run_" + randomHex(8),
		WorkflowID:  wf.ID,
		WorkflowVer: wf.Version,
		Status:      domain.RunStatusRunning,
		Params:      params,
		StepRuns:    make([]domain.StepRun, 0, len(wf.Steps)),
		Evidence:    []domain.Evidence{},
		Approvals:   []domain.ApprovalRecord{},
		StartedAt:   e.now(),
	}
	for _, step := range wf.Steps {
		run.StepRuns = append(run.StepRuns, domain.StepRun{
			StepID: step.ID,
			Uses:   step.Uses,
			Status: domain.StepStatusPending,
		})
	}
	if err := e.store.SaveRun(run); err != nil {
		return domain.Run{}, err
	}

	runCtx, cancel := context.WithCancel(ctx)
	e.mu.Lock()
	e.cancel[run.ID] = cancel
	e.mu.Unlock()

	go e.execute(runCtx, wf, run.ID)
	return run, nil
}

func (e *Engine) Approve(runID, stepID, decision, actor string) error {
	key := runID + "/" + stepID
	e.mu.Lock()
	ch := e.approvals[key]
	e.mu.Unlock()
	if ch == nil {
		return fmt.Errorf("no pending approval for %s/%s", runID, stepID)
	}
	ch <- approvalDecision{Decision: decision, Actor: actor}
	return nil
}

// ResolveHumanHelp unblocks a WAITING_HUMAN gui step and notifies the GUI operator.
func (e *Engine) ResolveHumanHelp(ctx context.Context, runID, stepID string, ok bool, note, actor string) error {
	key := runID + "/" + stepID
	e.mu.Lock()
	wait := e.humanHelp[key]
	e.mu.Unlock()
	if wait == nil {
		return fmt.Errorf("no pending human_help for %s/%s", runID, stepID)
	}
	if e.gui != nil && wait.HelpID != "" {
		if err := e.gui.ResolveHumanHelp(ctx, guiclient.HumanHelpResolveRequest{
			HelpID: wait.HelpID,
			OK:     ok,
			Note:   note,
		}); err != nil {
			// Viewer may have already resolved the operator ticket.
			msg := err.Error()
			if !strings.Contains(msg, "404") && !strings.Contains(msg, "unknown helpId") {
				return fmt.Errorf("gui operator resolve: %w", err)
			}
		}
	}
	wait.ch <- humanHelpDecision{OK: ok, Note: note, Actor: actor}
	return nil
}

func (e *Engine) Abort(runID string) error {
	e.mu.Lock()
	cancel := e.cancel[runID]
	e.mu.Unlock()
	if cancel == nil {
		return fmt.Errorf("run not active")
	}
	cancel()
	return nil
}

func (e *Engine) execute(ctx context.Context, wf domain.Workflow, runID string) {
	evStore, err := evidence.NewStore(e.store.RunDir(runID))
	if err != nil {
		e.failRun(runID, err.Error())
		return
	}

	scope := expr.Scope{Params: map[string]any{}, Vars: map[string]any{}}
	run, err := e.store.GetRun(runID)
	if err != nil {
		return
	}
	for k, v := range run.Params {
		scope.Params[k] = v
	}

	completed := map[string]domain.StepStatus{}
	byID := map[string]domain.Step{}
	for _, s := range wf.Steps {
		byID[s.ID] = s
	}

	for {
		if ctx.Err() != nil {
			e.finish(runID, domain.RunStatusAborted, "aborted", evStore)
			return
		}
		run, err = e.store.GetRun(runID)
		if err != nil {
			return
		}

		progress := false
		allDone := true
		for i := range run.StepRuns {
			sr := &run.StepRuns[i]
			if sr.Status == domain.StepStatusPending {
				allDone = false
				step := byID[sr.StepID]
				if !depsReady(step, completed) {
					continue
				}
				if step.When != "" {
					ok, err := expr.EvalBool(step.When, scope)
					if err != nil {
						e.failStep(&run, sr, err.Error(), evStore)
						e.persist(run, evStore)
						e.finish(runID, domain.RunStatusFailed, err.Error(), evStore)
						return
					}
					if !ok {
						sr.Status = domain.StepStatusSkipped
						completed[sr.StepID] = sr.Status
						_ = evStore.WriteStep(*sr)
						progress = true
						continue
					}
				}

				switch step.Uses {
				case domain.StepUsesCLI:
					if err := e.runCLI(ctx, &run, sr, step, &scope, evStore); err != nil {
						e.persist(run, evStore)
						e.finish(runID, domain.RunStatusFailed, err.Error(), evStore)
						return
					}
					completed[sr.StepID] = sr.Status
					progress = true
				case domain.StepUsesApproval:
					if err := e.runApproval(ctx, &run, sr, step, scope, evStore); err != nil {
						e.persist(run, evStore)
						status := domain.RunStatusFailed
						if ctx.Err() != nil {
							status = domain.RunStatusAborted
						}
						e.finish(runID, status, err.Error(), evStore)
						return
					}
					completed[sr.StepID] = sr.Status
					progress = true
				case domain.StepUsesAI:
					if err := e.runAI(ctx, &run, sr, step, &scope, evStore); err != nil {
						e.persist(run, evStore)
						e.finish(runID, domain.RunStatusFailed, err.Error(), evStore)
						return
					}
					completed[sr.StepID] = sr.Status
					progress = true
				case domain.StepUsesGUI:
					if err := e.runGUI(ctx, &run, sr, step, &scope, evStore); err != nil {
						e.persist(run, evStore)
						e.finish(runID, domain.RunStatusFailed, err.Error(), evStore)
						return
					}
					completed[sr.StepID] = sr.Status
					progress = true
				default:
					e.failStep(&run, sr, fmt.Sprintf("unsupported step type %s", step.Uses), evStore)
					e.persist(run, evStore)
					e.finish(runID, domain.RunStatusFailed, sr.Error, evStore)
					return
				}
			} else if sr.Status == domain.StepStatusWaitingApproval {
				allDone = false
			} else if sr.Status != domain.StepStatusCompleted && sr.Status != domain.StepStatusSkipped {
				allDone = false
			}
		}

		e.persist(run, evStore)
		if allDone {
			e.finish(runID, domain.RunStatusCompleted, "", evStore)
			return
		}
		if !progress {
			time.Sleep(20 * time.Millisecond)
		}
	}
}

func (e *Engine) runCLI(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope *expr.Scope, evStore *evidence.Store) error {
	now := e.now()
	sr.Status = domain.StepStatusRunning
	sr.StartedAt = &now
	argv := make([]string, 0, len(step.Argv))
	for _, a := range step.Argv {
		s, err := expr.EvalString(a, *scope)
		if err != nil {
			e.failStep(run, sr, err.Error(), evStore)
			return err
		}
		argv = append(argv, s)
	}

	res, _, err := e.runner.Run(ctx, clirunner.RunRequest{
		CLIName: step.CLI,
		Argv:    argv,
	})
	end := e.now()
	sr.CompletedAt = &end
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}

	okExit := res.ExitCode == 0 || res.ExitCode == 9
	var parsed map[string]any
	if len(bytesTrim(res.Stdout)) > 0 {
		if err := json.Unmarshal(res.Stdout, &parsed); err != nil {
			e.failStep(run, sr, fmt.Sprintf("invalid cli json: %v", err), evStore)
			_, _ = e.writeCLIEvidence(run, step, argv, res, sr.Status, evStore)
			return fmt.Errorf("invalid cli json")
		}
	}

	evStatus := domain.StepStatusCompleted
	if !okExit {
		evStatus = domain.StepStatusFailed
		sr.Status = domain.StepStatusFailed
		sr.Error = fmt.Sprintf("cli exit %d: %s", res.ExitCode, strings.TrimSpace(string(res.Stderr)))
		_, _ = e.writeCLIEvidence(run, step, argv, res, evStatus, evStore)
		return fmt.Errorf("%s", sr.Error)
	}

	sr.Status = domain.StepStatusCompleted
	sr.Output = parsed
	if step.Out != "" {
		scope.Vars[step.Out] = parsed
	}
	_, _ = e.writeCLIEvidence(run, step, argv, res, evStatus, evStore)
	_ = evStore.WriteStep(*sr)
	return nil
}

func (e *Engine) runAI(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope *expr.Scope, evStore *evidence.Store) error {
	if e.ai == nil {
		err := fmt.Errorf("ai runner is not configured")
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	now := e.now()
	sr.Status = domain.StepStatusRunning
	sr.StartedAt = &now

	prompt, err := expr.EvalString(step.AIPrompt, *scope)
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}

	input := map[string]any{
		"params": scope.Params,
		"vars":   scope.Vars,
	}
	for k, v := range scope.Vars {
		input[k] = v
	}

	out, err := e.ai.AIStep(ctx, pi.AIStepRequest{
		RunID:        run.ID,
		StepID:       step.ID,
		Prompt:       prompt,
		Input:        input,
		OutputSchema: step.OutputSchema,
		Model:        step.AIModel,
	})
	end := e.now()
	sr.CompletedAt = &end
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		_, _ = e.writeAIEvidence(run, step, prompt, nil, "", "", "", domain.StepStatusFailed, err.Error(), evStore)
		return err
	}
	if err := validateAIRequired(out.JSON, step.OutputSchema); err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		_, _ = e.writeAIEvidence(run, step, prompt, out.JSON, out.Mode, out.Model, out.RawTraceID, domain.StepStatusFailed, err.Error(), evStore)
		return err
	}

	sr.Status = domain.StepStatusCompleted
	sr.Output = out.JSON
	if step.Out != "" {
		scope.Vars[step.Out] = out.JSON
	}
	_, _ = e.writeAIEvidence(run, step, prompt, out.JSON, out.Mode, out.Model, out.RawTraceID, domain.StepStatusCompleted, "", evStore)
	_ = evStore.WriteStep(*sr)
	return nil
}

func validateAIRequired(json map[string]any, schema map[string]any) error {
	if schema == nil {
		return nil
	}
	raw, ok := schema["required"]
	if !ok {
		return nil
	}
	arr, ok := raw.([]any)
	if !ok {
		// YAML may decode as []string via map[string]any from json; also handle []string
		if strs, ok := raw.([]string); ok {
			for _, key := range strs {
				if _, exists := json[key]; !exists {
					return fmt.Errorf("ai output missing required key %q", key)
				}
			}
			return nil
		}
		return nil
	}
	for _, item := range arr {
		key, _ := item.(string)
		if key == "" {
			continue
		}
		if _, exists := json[key]; !exists {
			return fmt.Errorf("ai output missing required key %q", key)
		}
	}
	return nil
}

func (e *Engine) runGUI(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope *expr.Scope, evStore *evidence.Store) error {
	if e.gui == nil {
		err := fmt.Errorf("gui runner is not configured")
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	switch step.Action {
	case "screenshot_and_confirm":
		return e.runGUIScreenshot(ctx, run, sr, step, scope, evStore)
	case "human_help":
		return e.runGUIHumanHelp(ctx, run, sr, step, scope, evStore)
	default:
		err := fmt.Errorf("unsupported gui action %q (supported: screenshot_and_confirm, human_help)", step.Action)
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
}

func (e *Engine) runGUIScreenshot(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope *expr.Scope, evStore *evidence.Store) error {
	now := e.now()
	sr.Status = domain.StepStatusRunning
	sr.StartedAt = &now

	urlRaw, _ := step.GUI["url"].(string)
	if strings.TrimSpace(urlRaw) == "" {
		err := fmt.Errorf("gui.url is required")
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	url, err := expr.EvalString(urlRaw, *scope)
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	selector := ""
	if s, ok := step.GUI["selector"].(string); ok && s != "" {
		selector, err = expr.EvalString(s, *scope)
		if err != nil {
			e.failStep(run, sr, err.Error(), evStore)
			return err
		}
	}

	out, err := e.gui.ScreenshotAndConfirm(ctx, guiclient.ScreenshotAndConfirmRequest{
		URL:      url,
		Selector: selector,
	})
	end := e.now()
	sr.CompletedAt = &end
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		_, _ = e.writeGUIEvidence(run, step, url, selector, nil, "", domain.StepStatusFailed, err.Error(), evStore)
		return err
	}

	result := map[string]any{
		"ok":     true,
		"mode":   out.Mode,
		"action": step.Action,
	}
	sr.Status = domain.StepStatusCompleted
	written, werr := e.writeGUIEvidence(run, step, url, selector, out.Screenshot, out.Mode, domain.StepStatusCompleted, "", evStore)
	if werr != nil {
		e.failStep(run, sr, werr.Error(), evStore)
		return werr
	}
	result["screenshotPath"] = written.ScreenshotRef
	sr.Output = result
	if step.Out != "" {
		scope.Vars[step.Out] = result
	}
	_ = evStore.WriteStep(*sr)
	return nil
}

func (e *Engine) runGUIHumanHelp(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope *expr.Scope, evStore *evidence.Store) error {
	now := e.now()
	sr.Status = domain.StepStatusWaitingHuman
	sr.StartedAt = &now

	reasonRaw := step.Prompt
	if reasonRaw == "" {
		if r, ok := step.GUI["reason"].(string); ok {
			reasonRaw = r
		}
	}
	if strings.TrimSpace(reasonRaw) == "" {
		reasonRaw = "human help required"
	}
	reason, err := expr.EvalString(reasonRaw, *scope)
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	sr.Prompt = reason

	helpURL := ""
	if u, ok := step.GUI["url"].(string); ok && strings.TrimSpace(u) != "" {
		helpURL, err = expr.EvalString(u, *scope)
		if err != nil {
			e.failStep(run, sr, err.Error(), evStore)
			return err
		}
	}

	started, err := e.gui.StartHumanHelp(ctx, guiclient.HumanHelpStartRequest{
		Reason: reason,
		URL:    helpURL,
	})
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}

	run.Status = domain.RunStatusWaitingHuman
	sr.Output = map[string]any{
		"ok":        false,
		"action":    step.Action,
		"helpId":    started.HelpID,
		"status":    "waiting",
		"reason":    reason,
		"mode":      started.Mode,
		"viewerUrl": started.ViewerURL,
		"sessionId": started.SessionID,
	}
	if helpURL != "" {
		sr.Output["url"] = helpURL
	}
	_ = evStore.WriteStep(*sr)
	e.persist(*run, evStore)

	key := run.ID + "/" + step.ID
	wait := &humanHelpWait{
		HelpID: started.HelpID,
		ch:     make(chan humanHelpDecision, 1),
	}
	e.mu.Lock()
	e.humanHelp[key] = wait
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.humanHelp, key)
		e.mu.Unlock()
	}()

	select {
	case <-ctx.Done():
		sr.Status = domain.StepStatusAborted
		sr.Error = "aborted"
		end := e.now()
		sr.CompletedAt = &end
		return ctx.Err()
	case d := <-wait.ch:
		end := e.now()
		sr.CompletedAt = &end
		result := map[string]any{
			"ok":        d.OK,
			"action":    step.Action,
			"helpId":    started.HelpID,
			"note":      d.Note,
			"actor":     d.Actor,
			"mode":      started.Mode,
			"reason":    reason,
			"viewerUrl": started.ViewerURL,
		}
		if !d.OK {
			sr.Status = domain.StepStatusFailed
			sr.Error = "human_help rejected"
			sr.Output = result
			run.Status = domain.RunStatusFailed
			_ = evStore.WriteStep(*sr)
			return fmt.Errorf("human_help rejected")
		}
		sr.Status = domain.StepStatusCompleted
		sr.Output = result
		if step.Out != "" {
			scope.Vars[step.Out] = result
		}
		run.Status = domain.RunStatusRunning
		_ = evStore.WriteStep(*sr)
		return nil
	}
}

func (e *Engine) writeGUIEvidence(run *domain.Run, step domain.Step, url, selector string, png []byte, mode string, status domain.StepStatus, errMsg string, evStore *evidence.Store) (domain.Evidence, error) {
	ev := domain.Evidence{
		ID:        "ev_" + randomHex(6),
		RunID:     run.ID,
		StepID:    step.ID,
		Type:      "gui",
		StartedAt: e.now(),
		EndedAt:   e.now(),
		Status:    status,
		InputSummary: map[string]any{
			"action":   step.Action,
			"url":      url,
			"selector": selector,
			"mode":     mode,
		},
		Error: errMsg,
	}
	if len(png) == 0 {
		// still persist meta without bytes on failure
		png = []byte{}
	}
	if status == domain.StepStatusCompleted {
		ev.OutputSummary = map[string]any{"bytes": len(png), "contentType": "image/png"}
	}
	written, err := evStore.WriteGUI(ev, png)
	if err != nil {
		return ev, err
	}
	run.Evidence = append(run.Evidence, written)
	return written, nil
}

func (e *Engine) writeAIEvidence(run *domain.Run, step domain.Step, prompt string, output map[string]any, mode, model, rawTraceID string, status domain.StepStatus, errMsg string, evStore *evidence.Store) (domain.Evidence, error) {
	effectiveModel := model
	if effectiveModel == "" {
		effectiveModel = step.AIModel
	}
	ev := domain.Evidence{
		ID:        "ev_" + randomHex(6),
		RunID:     run.ID,
		StepID:    step.ID,
		Type:      "ai",
		StartedAt: e.now(),
		EndedAt:   e.now(),
		Status:    status,
		InputSummary: map[string]any{
			"prompt":     prompt,
			"model":      effectiveModel,
			"mode":       mode,
			"rawTraceId": rawTraceID,
		},
		Error: errMsg,
	}
	if output != nil {
		keys := make([]string, 0, len(output))
		for k := range output {
			keys = append(keys, k)
		}
		ev.OutputSummary = map[string]any{"keys": keys}
	}
	raw, _ := json.MarshalIndent(output, "", "  ")
	written, err := evStore.WriteAI(ev, raw)
	if err != nil {
		return ev, err
	}
	run.Evidence = append(run.Evidence, written)
	return written, nil
}

func (e *Engine) runApproval(ctx context.Context, run *domain.Run, sr *domain.StepRun, step domain.Step, scope expr.Scope, evStore *evidence.Store) error {
	now := e.now()
	sr.Status = domain.StepStatusWaitingApproval
	sr.StartedAt = &now
	prompt, err := expr.EvalString(step.Prompt, scope)
	if err != nil {
		e.failStep(run, sr, err.Error(), evStore)
		return err
	}
	sr.Prompt = prompt
	rec := domain.ApprovalRecord{
		ID:        "appr_" + randomHex(6),
		RunID:     run.ID,
		StepID:    step.ID,
		Prompt:    prompt,
		CreatedAt: now,
	}
	run.Approvals = append(run.Approvals, rec)
	run.Status = domain.RunStatusWaitingApproval
	_ = evStore.WriteApproval(rec)
	_ = evStore.WriteStep(*sr)
	e.persist(*run, evStore)

	key := run.ID + "/" + step.ID
	ch := make(chan approvalDecision, 1)
	e.mu.Lock()
	e.approvals[key] = ch
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.approvals, key)
		e.mu.Unlock()
	}()

	select {
	case <-ctx.Done():
		sr.Status = domain.StepStatusAborted
		sr.Error = "aborted"
		return ctx.Err()
	case d := <-ch:
		decided := e.now()
		for i := range run.Approvals {
			if run.Approvals[i].StepID == step.ID && run.Approvals[i].Decision == "" {
				run.Approvals[i].Decision = d.Decision
				run.Approvals[i].Actor = d.Actor
				run.Approvals[i].DecidedAt = &decided
				_ = evStore.WriteApproval(run.Approvals[i])
				break
			}
		}
		if d.Decision != "approve" {
			sr.Status = domain.StepStatusFailed
			sr.CompletedAt = &decided
			sr.Error = "approval rejected"
			run.Status = domain.RunStatusFailed
			return fmt.Errorf("approval rejected")
		}
		sr.Status = domain.StepStatusCompleted
		sr.CompletedAt = &decided
		run.Status = domain.RunStatusRunning
		_ = evStore.WriteStep(*sr)
		return nil
	}
}

func (e *Engine) writeCLIEvidence(run *domain.Run, step domain.Step, argv []string, res clirunner.RunResult, status domain.StepStatus, evStore *evidence.Store) (domain.Evidence, error) {
	code := res.ExitCode
	ev := domain.Evidence{
		ID:        "ev_" + randomHex(6),
		RunID:     run.ID,
		StepID:    step.ID,
		Type:      "cli",
		StartedAt: e.now().Add(-res.Duration),
		EndedAt:   e.now(),
		Status:    status,
		InputSummary: map[string]any{
			"cli":  step.CLI,
			"argv": argv,
		},
		ExitCode: &code,
	}
	if len(res.Stdout) > 0 {
		var parsed map[string]any
		if json.Unmarshal(res.Stdout, &parsed) == nil {
			keys := make([]string, 0, len(parsed))
			for k := range parsed {
				keys = append(keys, k)
			}
			ev.OutputSummary = map[string]any{"keys": keys, "ok": parsed["ok"]}
		}
	}
	written, err := evStore.WriteCLI(ev, res.Stdout, res.Stderr)
	if err != nil {
		return ev, err
	}
	run.Evidence = append(run.Evidence, written)
	return written, nil
}

func (e *Engine) failStep(run *domain.Run, sr *domain.StepRun, msg string, evStore *evidence.Store) {
	now := e.now()
	sr.Status = domain.StepStatusFailed
	sr.CompletedAt = &now
	sr.Error = msg
	_ = evStore.WriteStep(*sr)
}

func (e *Engine) failRun(runID, msg string) {
	run, err := e.store.GetRun(runID)
	if err != nil {
		return
	}
	run.Status = domain.RunStatusFailed
	run.Error = msg
	now := e.now()
	run.CompletedAt = &now
	_ = e.store.SaveRun(run)
}

func (e *Engine) persist(run domain.Run, evStore *evidence.Store) {
	_ = e.store.SaveRun(run)
	_ = evStore.WriteRun(run)
}

func (e *Engine) finish(runID string, status domain.RunStatus, msg string, evStore *evidence.Store) {
	run, err := e.store.GetRun(runID)
	if err != nil {
		return
	}
	run.Status = status
	run.Error = msg
	now := e.now()
	run.CompletedAt = &now
	_ = e.store.SaveRun(run)
	_ = evStore.WriteRun(run)
	e.mu.Lock()
	if cancel := e.cancel[runID]; cancel != nil {
		cancel()
		delete(e.cancel, runID)
	}
	e.mu.Unlock()
}

func depsReady(step domain.Step, completed map[string]domain.StepStatus) bool {
	for _, need := range step.Needs {
		st, ok := completed[need]
		if !ok {
			return false
		}
		if st != domain.StepStatusCompleted && st != domain.StepStatusSkipped {
			return false
		}
	}
	return true
}

func validateParams(wf domain.Workflow, params map[string]any) error {
	for name, p := range wf.Params {
		if p.Required {
			if params == nil {
				return fmt.Errorf("missing required param %s", name)
			}
			if _, ok := params[name]; !ok {
				return fmt.Errorf("missing required param %s", name)
			}
		}
	}
	return nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func bytesTrim(b []byte) []byte {
	return []byte(strings.TrimSpace(string(b)))
}
