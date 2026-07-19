package runtime

import (
	"os"
	"os/exec"
	"sort"

	"github.com/Duang777/helios/backend/internal/domain"
)

type AdapterRegistry interface {
	Status(adapterID string) domain.AdapterStatus
	Statuses() []domain.AdapterStatus
}

type defaultAdapterRegistry struct{}

func NewDefaultAdapterRegistry() AdapterRegistry {
	return defaultAdapterRegistry{}
}

func (defaultAdapterRegistry) Status(adapterID string) domain.AdapterStatus {
	statuses := defaultAdapterRegistry{}.Statuses()
	for _, status := range statuses {
		if status.ID == adapterID {
			return status
		}
	}
	return domain.AdapterStatus{ID: adapterID, Label: adapterID, Kind: "unknown", Available: false, Reason: "adapter is not registered"}
}

func (defaultAdapterRegistry) Statuses() []domain.AdapterStatus {
	statuses := []domain.AdapterStatus{
		probeModelAdapter("codex_runtime", "Codex Runtime", "CODEX_RUNTIME_COMMAND", "CODEX_RUNTIME_URL", []string{"CODEX_API_KEY"}, "codex"),
		probeModelAdapter("claude", "Claude", "CLAUDE_COMMAND", "CLAUDE_RUNTIME_URL", []string{"CLAUDE_API_KEY", "ANTHROPIC_API_KEY"}, "claude"),
		{ID: "router", Label: "Intent Router", Kind: "internal", Available: true, Reason: "built-in deterministic router"},
		{ID: "local_tools", Label: "Local Tools", Kind: "tool", Available: true, Command: "shell/files/browser/mcp", Reason: "local workspace tools are available to the runtime host"},
		{ID: "human_gate", Label: "Human Gate", Kind: "approval", Available: true, Reason: "approval gate is built into the runtime"},
		{ID: "helios_runtime", Label: "Go DAG Runtime", Kind: "runtime", Available: true, Reason: "in-process DAG executor is active"},
		{ID: "audit_store", Label: "Evidence Ledger", Kind: "audit", Available: true, Reason: "in-memory evidence ledger is active"},
		{ID: "deterministic_mvp", Label: "Deterministic MVP", Kind: "internal", Available: true, Reason: "legacy deterministic template executor"},
	}
	sort.Slice(statuses, func(i, j int) bool { return statuses[i].ID < statuses[j].ID })
	return statuses
}

func probeModelAdapter(id, label, commandEnv, urlEnv string, secretEnv []string, cliName string) domain.AdapterStatus {
	envKeys := append([]string{commandEnv, urlEnv}, secretEnv...)
	status := domain.AdapterStatus{ID: id, Label: label, Kind: "model", Env: envKeys, Meta: map[string]string{"cli": cliName}}
	if command := os.Getenv(commandEnv); command != "" {
		status.Available = true
		status.Command = command
		status.Reason = commandEnv + " is configured"
		status.Meta["executionMode"] = "command"
		status.Meta["configuredBy"] = commandEnv
		return status
	}
	if endpoint := os.Getenv(urlEnv); endpoint != "" {
		status.Available = true
		status.Endpoint = endpoint
		status.Reason = urlEnv + " is configured"
		status.Meta["executionMode"] = "http"
		status.Meta["configuredBy"] = urlEnv
		for _, key := range secretEnv {
			if os.Getenv(key) != "" {
				status.Meta["apiKeyEnv"] = key
				break
			}
		}
		return status
	}
	if path, err := exec.LookPath(cliName); err == nil {
		status.Endpoint = path
		status.Reason = cliName + " CLI found, but non-interactive execution is not configured; set " + commandEnv + " or " + urlEnv
		status.Meta["path"] = path
		return status
	}
	status.Reason = commandEnv + " or " + urlEnv + " is not configured"
	return status
}

type staticAdapterRegistry map[string]domain.AdapterStatus

func StaticAdapterRegistry(statuses map[string]domain.AdapterStatus) AdapterRegistry {
	return staticAdapterRegistry(statuses)
}

func (s staticAdapterRegistry) Status(adapterID string) domain.AdapterStatus {
	if status, ok := s[adapterID]; ok {
		if status.ID == "" {
			status.ID = adapterID
		}
		return status
	}
	return domain.AdapterStatus{ID: adapterID, Label: adapterID, Kind: "unknown", Available: false, Reason: "adapter is not registered in test registry"}
}

func (s staticAdapterRegistry) Statuses() []domain.AdapterStatus {
	statuses := make([]domain.AdapterStatus, 0, len(s))
	for id, status := range s {
		if status.ID == "" {
			status.ID = id
		}
		statuses = append(statuses, status)
	}
	sort.Slice(statuses, func(i, j int) bool { return statuses[i].ID < statuses[j].ID })
	return statuses
}
