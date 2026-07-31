package domain

import "time"

type StepUses string

const (
	StepUsesCLI      StepUses = "cli"
	StepUsesGUI      StepUses = "gui"
	StepUsesAI       StepUses = "ai"
	StepUsesApproval StepUses = "approval"
	StepUsesCode     StepUses = "code"
)

type SideEffect string

const (
	SideEffectNone  SideEffect = "none"
	SideEffectRead  SideEffect = "read"
	SideEffectWrite SideEffect = "write"
)

type RunStatus string

const (
	RunStatusPending          RunStatus = "PENDING"
	RunStatusRunning          RunStatus = "RUNNING"
	RunStatusWaitingApproval  RunStatus = "WAITING_APPROVAL"
	RunStatusWaitingHuman     RunStatus = "WAITING_HUMAN"
	RunStatusPaused           RunStatus = "PAUSED"
	RunStatusCompleted        RunStatus = "COMPLETED"
	RunStatusFailed           RunStatus = "FAILED"
	RunStatusAborted          RunStatus = "ABORTED"
)

type StepStatus string

const (
	StepStatusPending          StepStatus = "PENDING"
	StepStatusReady            StepStatus = "READY"
	StepStatusRunning          StepStatus = "RUNNING"
	StepStatusWaitingApproval  StepStatus = "WAITING_APPROVAL"
	StepStatusWaitingHuman     StepStatus = "WAITING_HUMAN"
	StepStatusSkipped          StepStatus = "SKIPPED"
	StepStatusCompleted        StepStatus = "COMPLETED"
	StepStatusFailed           StepStatus = "FAILED"
	StepStatusAborted          StepStatus = "ABORTED"
)

type Param struct {
	Type        string `yaml:"type" json:"type"`
	Required    bool   `yaml:"required,omitempty" json:"required,omitempty"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

type CLIRequirement struct {
	Name    string `yaml:"name" json:"name"`
	Version string `yaml:"version,omitempty" json:"version,omitempty"`
}

type Requires struct {
	CLIs []CLIRequirement `yaml:"clis,omitempty" json:"clis,omitempty"`
}

type Step struct {
	ID           string         `yaml:"id" json:"id"`
	Uses         StepUses       `yaml:"uses" json:"uses"`
	Needs        []string       `yaml:"needs,omitempty" json:"needs,omitempty"`
	When         string         `yaml:"when,omitempty" json:"when,omitempty"`
	Out          string         `yaml:"out,omitempty" json:"out,omitempty"`
	SideEffect   SideEffect     `yaml:"sideEffect,omitempty" json:"sideEffect,omitempty"`
	CLI          string         `yaml:"cli,omitempty" json:"cli,omitempty"`
	Argv         []string       `yaml:"argv,omitempty" json:"argv,omitempty"`
	Prompt       string         `yaml:"prompt,omitempty" json:"prompt,omitempty"`
	Action       string         `yaml:"action,omitempty" json:"action,omitempty"`
	GUI          map[string]any `yaml:"gui,omitempty" json:"gui,omitempty"`
	AIPrompt     string         `yaml:"aiPrompt,omitempty" json:"aiPrompt,omitempty"`
	AIModel      string         `yaml:"aiModel,omitempty" json:"aiModel,omitempty"`
	OutputSchema map[string]any `yaml:"outputSchema,omitempty" json:"outputSchema,omitempty"`
}

type Workflow struct {
	APIVersion  string           `yaml:"apiVersion" json:"apiVersion"`
	Kind        string           `yaml:"kind" json:"kind"`
	ID          string           `yaml:"id" json:"id"`
	Version     int              `yaml:"version" json:"version"`
	Description string           `yaml:"description,omitempty" json:"description,omitempty"`
	Params      map[string]Param `yaml:"params" json:"params"`
	Requires    Requires         `yaml:"requires,omitempty" json:"requires,omitempty"`
	AutoApprove bool             `yaml:"autoApprove,omitempty" json:"autoApprove,omitempty"`
	Steps       []Step           `yaml:"steps" json:"steps"`
}

type Manifest struct {
	ID                string           `json:"id"`
	Version           int              `json:"version"`
	Title             string           `json:"title"`
	Params            map[string]Param `json:"params"`
	SideEffectLevel   SideEffect       `json:"sideEffectLevel"`
	RequiresApprovals bool             `json:"requiresApprovals"`
	CLIs              []string         `json:"clis"`
}

type StepRun struct {
	StepID      string         `json:"stepId"`
	Uses        StepUses       `json:"uses"`
	Status      StepStatus     `json:"status"`
	StartedAt   *time.Time     `json:"startedAt,omitempty"`
	CompletedAt *time.Time     `json:"completedAt,omitempty"`
	Error       string         `json:"error,omitempty"`
	Output      map[string]any `json:"output,omitempty"`
	Prompt      string         `json:"prompt,omitempty"`
}

type ApprovalRecord struct {
	ID        string    `json:"id"`
	RunID     string    `json:"runId"`
	StepID    string    `json:"stepId"`
	Prompt    string    `json:"prompt"`
	Decision  string    `json:"decision,omitempty"`
	Actor     string    `json:"actor,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	DecidedAt *time.Time `json:"decidedAt,omitempty"`
}

type Evidence struct {
	ID            string         `json:"id"`
	RunID         string         `json:"runId"`
	StepID        string         `json:"stepId"`
	Type          string         `json:"type"`
	StartedAt     time.Time      `json:"startedAt"`
	EndedAt       time.Time      `json:"endedAt"`
	Status        StepStatus     `json:"status"`
	InputSummary  map[string]any `json:"inputSummary,omitempty"`
	OutputSummary map[string]any `json:"outputSummary,omitempty"`
	ExitCode      *int           `json:"exitCode,omitempty"`
	StdoutRef     string         `json:"stdoutRef,omitempty"`
	StderrRef     string         `json:"stderrRef,omitempty"`
	ScreenshotRef string         `json:"screenshotRef,omitempty"`
	Error         string         `json:"error,omitempty"`
}

type Run struct {
	ID          string           `json:"id"`
	WorkflowID  string           `json:"workflowId"`
	WorkflowVer int              `json:"workflowVersion"`
	Status      RunStatus        `json:"status"`
	Params      map[string]any   `json:"params"`
	StepRuns    []StepRun        `json:"stepRuns"`
	Evidence    []Evidence       `json:"evidence"`
	Approvals   []ApprovalRecord `json:"approvals"`
	Error       string           `json:"error,omitempty"`
	StartedAt   time.Time        `json:"startedAt"`
	CompletedAt *time.Time       `json:"completedAt,omitempty"`
}

type CLIArgSpec struct {
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Required bool     `json:"required,omitempty"`
	Enum     []string `json:"enum,omitempty"`
	Default  any      `json:"default,omitempty"`
}

type CLICommandSpec struct {
	Path       []string     `json:"path"`
	SideEffect SideEffect   `json:"sideEffect"`
	DryRun     bool         `json:"dryRun,omitempty"`
	Args       []CLIArgSpec `json:"args,omitempty"`
}

type CLIIntrospect struct {
	Name     string           `json:"name"`
	Version  string           `json:"version"`
	Commands []CLICommandSpec `json:"commands"`
}

type RegisteredCLI struct {
	Name       string        `json:"name"`
	Version    string        `json:"version"`
	Path       string        `json:"path"`
	Introspect CLIIntrospect `json:"introspect"`
}
