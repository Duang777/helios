package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
)

const version = "0.2.0"

func main() {
	if len(os.Args) < 2 {
		fail(2, "usage: helios-opencli <command>")
	}

	switch os.Args[1] {
	case "--version", "version":
		fmt.Println(version)
		return
	case "introspect":
		writeIntrospect()
		return
	default:
		proxy(os.Args[1:]...)
	}
}

func writeIntrospect() {
	doc := domain.CLIIntrospect{
		Name:    "helios-opencli",
		Version: version,
		Commands: []domain.CLICommandSpec{
			{Path: []string{"list"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "-f", Type: "string"},
				{Name: "--format", Type: "string"},
			}},
			{Path: []string{"doctor"}, SideEffect: domain.SideEffectRead},
			// Public HN API via OpenCLI — no Chrome login required (Slice P demo).
			{Path: []string{"hackernews", "top"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "--limit", Type: "number"},
				{Name: "-f", Type: "string"},
				{Name: "--format", Type: "string"},
			}},
			// Browser-session site (Slice Q): Bilibili crystallized adapters.
			{Path: []string{"bilibili", "hot"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "--limit", Type: "number"},
				{Name: "-f", Type: "string"},
				{Name: "--format", Type: "string"},
			}},
			{Path: []string{"bilibili", "whoami"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "-f", Type: "string"},
				{Name: "--format", Type: "string"},
			}},
			{Path: []string{"bilibili", "login"}, SideEffect: domain.SideEffectWrite, Args: []domain.CLIArgSpec{
				{Name: "--timeout", Type: "number"},
			}},
			{Path: []string{"introspect"}, SideEffect: domain.SideEffectNone},
		},
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(doc)
}

func proxy(args ...string) {
	if len(args) > 0 && args[0] == "browser" {
		fail(2, "browser free-form sessions are not allowlisted; use crystallized opencli commands only")
	}
	bin, err := resolveOpenCLI()
	if err != nil {
		fail(1, err.Error())
	}

	cmd := exec.Command(bin, args...)
	cmd.Env = os.Environ()
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	runErr := cmd.Run()
	exitCode := 0
	if runErr != nil {
		if ee, ok := runErr.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			fail(1, runErr.Error())
		}
	}

	command := strings.Join(args, " ")
	env := wrapOutput(command, stdout.Bytes(), stderr.Bytes(), exitCode)
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(env)
	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

func resolveOpenCLI() (string, error) {
	if p := strings.TrimSpace(os.Getenv("HELIOS_OPENCLI_BIN")); p != "" {
		if _, err := os.Stat(p); err != nil {
			return "", fmt.Errorf("HELIOS_OPENCLI_BIN=%s: %w", p, err)
		}
		return p, nil
	}
	bin, err := exec.LookPath("opencli")
	if err != nil {
		return "", fmt.Errorf("opencli not found in PATH; install @jackwener/opencli or set HELIOS_OPENCLI_BIN")
	}
	return bin, nil
}

func fail(code int, msg string) {
	_ = json.NewEncoder(os.Stdout).Encode(map[string]any{
		"ok":      false,
		"command": "helios-opencli",
		"error":   msg,
	})
	os.Exit(code)
}
