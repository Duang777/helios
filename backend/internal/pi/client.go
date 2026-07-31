package pi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type CLISummary struct {
	Name     string           `json:"name"`
	Version  string           `json:"version"`
	Commands []CommandSummary `json:"commands"`
}

type CommandSummary struct {
	Path       []string `json:"path"`
	SideEffect string   `json:"sideEffect,omitempty"`
}

type DraftRequest struct {
	Intent         string         `json:"intent"`
	CLIs           []CLISummary   `json:"clis"`
	Hints          map[string]any `json:"hints,omitempty"`
	PreviousYAML   string         `json:"previousYAML,omitempty"`
	PreviousErrors []string       `json:"previousErrors,omitempty"`
}

type DraftResponse struct {
	YAML       string `json:"yaml"`
	Mode       string `json:"mode"`
	Model      string `json:"model,omitempty"`
	RawTraceID string `json:"rawTraceId"`
}

type AIStepRequest struct {
	RunID        string         `json:"runId"`
	StepID       string         `json:"stepId"`
	Prompt       string         `json:"prompt"`
	Input        map[string]any `json:"input,omitempty"`
	OutputSchema map[string]any `json:"outputSchema,omitempty"`
	Model        string         `json:"model,omitempty"`
}

type AIStepResponse struct {
	JSON       map[string]any `json:"json"`
	Mode       string         `json:"mode"`
	Model      string         `json:"model,omitempty"`
	RawTraceID string         `json:"rawTraceId"`
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
	timeout := 120 * time.Second
	if v := os.Getenv("HELIOS_PI_HTTP_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			timeout = d
		}
	}
	return &Client{
		BaseURL: stringsTrimRightSlash(baseURL),
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("pi sidecar health status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) Draft(ctx context.Context, in DraftRequest) (DraftResponse, error) {
	raw, err := json.Marshal(in)
	if err != nil {
		return DraftResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/compile", bytes.NewReader(raw))
	if err != nil {
		return DraftResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return DraftResponse{}, fmt.Errorf("pi sidecar unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return DraftResponse{}, err
	}
	if resp.StatusCode >= 300 {
		return DraftResponse{}, fmt.Errorf("pi sidecar compile status %d: %s", resp.StatusCode, string(body))
	}
	var out DraftResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return DraftResponse{}, fmt.Errorf("invalid pi sidecar response: %w", err)
	}
	if out.YAML == "" {
		return DraftResponse{}, fmt.Errorf("pi sidecar returned empty yaml")
	}
	return out, nil
}

func (c *Client) AIStep(ctx context.Context, in AIStepRequest) (AIStepResponse, error) {
	// Sidecar owns live repair retry; Go does not blind-retry.
	return c.aiStepOnce(ctx, in)
}

func (c *Client) aiStepOnce(ctx context.Context, in AIStepRequest) (AIStepResponse, error) {
	raw, err := json.Marshal(in)
	if err != nil {
		return AIStepResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/ai-step", bytes.NewReader(raw))
	if err != nil {
		return AIStepResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return AIStepResponse{}, fmt.Errorf("pi sidecar unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AIStepResponse{}, err
	}
	if resp.StatusCode >= 300 {
		return AIStepResponse{}, fmt.Errorf("pi sidecar ai-step status %d: %s", resp.StatusCode, string(body))
	}
	var out AIStepResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return AIStepResponse{}, fmt.Errorf("invalid pi sidecar ai-step response: %w", err)
	}
	if out.JSON == nil {
		return AIStepResponse{}, fmt.Errorf("pi sidecar returned empty ai json")
	}
	return out, nil
}

func stringsTrimRightSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
