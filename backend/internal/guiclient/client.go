package guiclient

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type ScreenshotAndConfirmRequest struct {
	URL      string `json:"url"`
	Selector string `json:"selector,omitempty"`
}

type ScreenshotAndConfirmResponse struct {
	OK                bool   `json:"ok"`
	ScreenshotBase64  string `json:"screenshotBase64"`
	ContentType       string `json:"contentType"`
	Mode              string `json:"mode"`
	SessionID         string `json:"sessionId,omitempty"`
	Screenshot        []byte `json:"-"`
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
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
		return fmt.Errorf("gui operator health status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) ScreenshotAndConfirm(ctx context.Context, in ScreenshotAndConfirmRequest) (ScreenshotAndConfirmResponse, error) {
	if strings.TrimSpace(in.URL) == "" {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("gui url is required")
	}
	raw, err := json.Marshal(in)
	if err != nil {
		return ScreenshotAndConfirmResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/actions/screenshot_and_confirm", bytes.NewReader(raw))
	if err != nil {
		return ScreenshotAndConfirmResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("gui operator unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ScreenshotAndConfirmResponse{}, err
	}
	if resp.StatusCode >= 300 {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("gui operator status %d: %s", resp.StatusCode, string(body))
	}
	var out ScreenshotAndConfirmResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("invalid gui operator response: %w", err)
	}
	if !out.OK {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("gui operator returned ok=false")
	}
	if out.ScreenshotBase64 == "" {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("gui operator returned empty screenshot")
	}
	png, err := base64.StdEncoding.DecodeString(out.ScreenshotBase64)
	if err != nil {
		return ScreenshotAndConfirmResponse{}, fmt.Errorf("invalid screenshot base64: %w", err)
	}
	out.Screenshot = png
	return out, nil
}

type HumanHelpStartRequest struct {
	Reason string `json:"reason,omitempty"`
	URL    string `json:"url,omitempty"`
}

type HumanHelpStartResponse struct {
	HelpID     string `json:"helpId"`
	Status     string `json:"status"`
	Reason     string `json:"reason,omitempty"`
	Mode       string `json:"mode,omitempty"`
	SessionID  string `json:"sessionId,omitempty"`
	ViewerURL  string `json:"viewerUrl,omitempty"`
	ViewerPath string `json:"viewerPath,omitempty"`
}

type HumanHelpResolveRequest struct {
	HelpID string `json:"helpId"`
	OK     bool   `json:"ok"`
	Note   string `json:"note,omitempty"`
}

func (c *Client) StartHumanHelp(ctx context.Context, in HumanHelpStartRequest) (HumanHelpStartResponse, error) {
	raw, err := json.Marshal(in)
	if err != nil {
		return HumanHelpStartResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/human_help/start", bytes.NewReader(raw))
	if err != nil {
		return HumanHelpStartResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return HumanHelpStartResponse{}, fmt.Errorf("gui operator unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return HumanHelpStartResponse{}, err
	}
	if resp.StatusCode >= 300 {
		return HumanHelpStartResponse{}, fmt.Errorf("gui operator status %d: %s", resp.StatusCode, string(body))
	}
	var out HumanHelpStartResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return HumanHelpStartResponse{}, err
	}
	if out.HelpID == "" {
		return HumanHelpStartResponse{}, fmt.Errorf("gui operator returned empty helpId")
	}
	return out, nil
}

func (c *Client) ResolveHumanHelp(ctx context.Context, in HumanHelpResolveRequest) error {
	raw, err := json.Marshal(in)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/human_help/resolve", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("gui operator unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("gui operator status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

type RunStep map[string]any

type RunRequest struct {
	Steps []RunStep `json:"steps"`
}

type RunResponse struct {
	OK               bool           `json:"ok"`
	ScreenshotBase64 string         `json:"screenshotBase64"`
	ContentType      string         `json:"contentType"`
	Mode             string         `json:"mode"`
	Results          []map[string]any `json:"results,omitempty"`
	Screenshot       []byte         `json:"-"`
}

func (c *Client) Run(ctx context.Context, in RunRequest) (RunResponse, error) {
	if len(in.Steps) == 0 {
		return RunResponse{}, fmt.Errorf("gui run requires steps")
	}
	raw, err := json.Marshal(in)
	if err != nil {
		return RunResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/actions/run", bytes.NewReader(raw))
	if err != nil {
		return RunResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return RunResponse{}, fmt.Errorf("gui operator unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return RunResponse{}, err
	}
	if resp.StatusCode >= 300 {
		return RunResponse{}, fmt.Errorf("gui operator status %d: %s", resp.StatusCode, string(body))
	}
	var out RunResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return RunResponse{}, fmt.Errorf("invalid gui operator response: %w", err)
	}
	if !out.OK {
		return RunResponse{}, fmt.Errorf("gui operator returned ok=false")
	}
	if out.ScreenshotBase64 == "" {
		return RunResponse{}, fmt.Errorf("gui operator returned empty screenshot")
	}
	png, err := base64.StdEncoding.DecodeString(out.ScreenshotBase64)
	if err != nil {
		return RunResponse{}, fmt.Errorf("invalid screenshot base64: %w", err)
	}
	out.Screenshot = png
	return out, nil
}
