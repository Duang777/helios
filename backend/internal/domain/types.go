package domain

import "time"

type NodeType string

const (
	NodeTypeLLMTask     NodeType = "llm_task"
	NodeTypeHTTPRequest NodeType = "http_request"
	NodeTypeForm        NodeType = "form"
	NodeTypeApproval    NodeType = "approval"
	NodeTypeCode        NodeType = "code"
	NodeTypeHumanTask   NodeType = "human_task"
	NodeTypeReport      NodeType = "report"
	NodeTypeDashboard   NodeType = "dashboard"
)

type RunStatus string

const (
	RunStatusPending   RunStatus = "PENDING"
	RunStatusRunning   RunStatus = "RUNNING"
	RunStatusCompleted RunStatus = "COMPLETED"
	RunStatusFailed    RunStatus = "FAILED"
)

type NodeStatus string

const (
	NodeStatusPending   NodeStatus = "PENDING"
	NodeStatusRunning   NodeStatus = "RUNNING"
	NodeStatusCompleted NodeStatus = "COMPLETED"
	NodeStatusFailed    NodeStatus = "FAILED"
)

type WorkflowTemplate struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Scenario   string         `json:"scenario"`
	Goal       string         `json:"goal"`
	Summary    string         `json:"summary"`
	Nodes      []WorkflowNode `json:"nodes"`
	Edges      []WorkflowEdge `json:"edges"`
	AgentRoles []AgentRole    `json:"agentRoles"`
	AppPages   []AppPage      `json:"appPages"`
	CreatedAt  time.Time      `json:"createdAt"`
}

type WorkflowNode struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Type         NodeType          `json:"type"`
	AgentRoleID  string            `json:"agentRoleId"`
	Prompt       string            `json:"prompt"`
	Inputs       []string          `json:"inputs"`
	Outputs      []string          `json:"outputs"`
	Dependencies []string          `json:"dependencies"`
	Config       map[string]string `json:"config,omitempty"`
}

type WorkflowEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type AgentRole struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Scope       string   `json:"scope"`
	Permissions []string `json:"permissions"`
}

type AppPage struct {
	ID       string            `json:"id"`
	NodeID   string            `json:"nodeId"`
	Kind     string            `json:"kind"`
	Title    string            `json:"title"`
	Fields   []AppField        `json:"fields,omitempty"`
	Sections []AppSection      `json:"sections,omitempty"`
	Meta     map[string]string `json:"meta,omitempty"`
}

type AppField struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Type     string   `json:"type"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type AppSection struct {
	Title string   `json:"title"`
	Items []string `json:"items"`
}

type WorkflowRun struct {
	ID          string          `json:"id"`
	WorkflowID  string          `json:"workflowId"`
	Goal        string          `json:"goal"`
	Status      RunStatus       `json:"status"`
	NodeRuns    []NodeRun       `json:"nodeRuns"`
	Evidence    []Evidence      `json:"evidence"`
	Artifacts   []Artifact      `json:"artifacts"`
	Approvals   []Approval      `json:"approvals"`
	Adapters    []AdapterStatus `json:"adapters,omitempty"`
	StartedAt   time.Time       `json:"startedAt"`
	CompletedAt *time.Time      `json:"completedAt,omitempty"`
}

type AdapterStatus struct {
	ID        string            `json:"id"`
	Label     string            `json:"label"`
	Kind      string            `json:"kind"`
	Available bool              `json:"available"`
	Reason    string            `json:"reason,omitempty"`
	Command   string            `json:"command,omitempty"`
	Endpoint  string            `json:"endpoint,omitempty"`
	Env       []string          `json:"env,omitempty"`
	Meta      map[string]string `json:"meta,omitempty"`
}

type NodeRun struct {
	ID          string            `json:"id"`
	NodeID      string            `json:"nodeId"`
	Title       string            `json:"title"`
	Type        NodeType          `json:"type"`
	AgentRoleID string            `json:"agentRoleId"`
	Status      NodeStatus        `json:"status"`
	Input       map[string]string `json:"input"`
	Output      map[string]string `json:"output"`
	StartedAt   time.Time         `json:"startedAt"`
	CompletedAt *time.Time        `json:"completedAt,omitempty"`
	Error       string            `json:"error,omitempty"`
}

type Evidence struct {
	ID         string   `json:"id"`
	NodeID     string   `json:"nodeId"`
	Claim      string   `json:"claim"`
	Sources    []string `json:"sources"`
	Confidence float64  `json:"confidence"`
}

type Artifact struct {
	ID      string `json:"id"`
	NodeID  string `json:"nodeId"`
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type Approval struct {
	ID        string `json:"id"`
	NodeID    string `json:"nodeId"`
	Title     string `json:"title"`
	Decision  string `json:"decision"`
	Reviewer  string `json:"reviewer"`
	Rationale string `json:"rationale"`
}
