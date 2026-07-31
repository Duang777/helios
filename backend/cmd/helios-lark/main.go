package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/Duang777/helios/backend/internal/domain"
)

const version = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		fail(2, "usage: helios-lark <command>")
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
		Name:    "helios-lark",
		Version: version,
		Commands: []domain.CLICommandSpec{
			{Path: []string{"doctor"}, SideEffect: domain.SideEffectRead},
			{Path: []string{"auth", "status"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "--verify", Type: "boolean"},
			}},
			{Path: []string{"auth", "login"}, SideEffect: domain.SideEffectWrite},
			{Path: []string{"im", "+chat-list"}, SideEffect: domain.SideEffectRead},
			{Path: []string{"im", "+messages-send"}, SideEffect: domain.SideEffectWrite, DryRun: true, Args: []domain.CLIArgSpec{
				{Name: "--chat-id", Type: "string"},
				{Name: "--user-id", Type: "string"},
				{Name: "--text", Type: "string"},
				{Name: "--markdown", Type: "string"},
				{Name: "--dry-run", Type: "boolean"},
			}},
			{Path: []string{"calendar", "+agenda"}, SideEffect: domain.SideEffectRead},
			{Path: []string{"api"}, SideEffect: domain.SideEffectWrite},
			{Path: []string{"introspect"}, SideEffect: domain.SideEffectNone},
		},
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(doc)
}

func proxy(args ...string) {
	bin, err := exec.LookPath("lark-cli")
	if err != nil {
		fail(1, "lark-cli not found in PATH; install with: npx @larksuite/cli@latest install")
	}
	cmd := exec.Command(bin, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	if err := cmd.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			if status, ok := ee.Sys().(syscall.WaitStatus); ok {
				os.Exit(status.ExitStatus())
			}
			os.Exit(ee.ExitCode())
		}
		fail(1, err.Error())
	}
}

func fail(code int, msg string) {
	_ = json.NewEncoder(os.Stdout).Encode(map[string]any{
		"ok":      false,
		"command": "helios-lark",
		"error":   msg,
	})
	os.Exit(code)
}
