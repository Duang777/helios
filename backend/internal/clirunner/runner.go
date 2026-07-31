package clirunner

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/Duang777/helios/backend/internal/domain"
	"github.com/Duang777/helios/backend/internal/registry"
)

type Runner struct {
	reg *registry.Registry
}

func New(reg *registry.Registry) *Runner {
	return &Runner{reg: reg}
}

type RunRequest struct {
	CLIName   string
	Argv      []string
	Env       []string
	WorkDir   string
	Timeout   time.Duration
	MaxStdout int64
	MaxStderr int64
}

type RunResult struct {
	ExitCode  int
	Stdout    []byte
	Stderr    []byte
	Duration  time.Duration
	Truncated bool
}

func (r *Runner) Run(ctx context.Context, req RunRequest) (RunResult, domain.RegisteredCLI, error) {
	rec, err := r.reg.Get(req.CLIName)
	if err != nil {
		return RunResult{}, domain.RegisteredCLI{}, err
	}
	if err := registry.Allowlisted(rec, req.Argv); err != nil {
		return RunResult{}, rec, err
	}
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	maxOut := req.MaxStdout
	if maxOut <= 0 {
		maxOut = 2 << 20
	}
	maxErr := req.MaxStderr
	if maxErr <= 0 {
		maxErr = 2 << 20
	}

	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(runCtx, rec.Path, req.Argv...)
	cmd.Dir = req.WorkDir
	if len(req.Env) > 0 {
		cmd.Env = req.Env
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &limitedWriter{buf: &stdout, limit: maxOut}
	cmd.Stderr = &limitedWriter{buf: &stderr, limit: maxErr}

	start := time.Now()
	err = cmd.Run()
	dur := time.Since(start)

	res := RunResult{
		Stdout:   stdout.Bytes(),
		Stderr:   stderr.Bytes(),
		Duration: dur,
	}
	if lw, ok := cmd.Stdout.(*limitedWriter); ok && lw.truncated {
		res.Truncated = true
	}
	if lw, ok := cmd.Stderr.(*limitedWriter); ok && lw.truncated {
		res.Truncated = true
	}

	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			res.ExitCode = ee.ExitCode()
			return res, rec, nil
		}
		if runCtx.Err() != nil {
			return res, rec, fmt.Errorf("cli timeout: %w", runCtx.Err())
		}
		return res, rec, err
	}
	res.ExitCode = 0
	return res, rec, nil
}

type limitedWriter struct {
	buf       *bytes.Buffer
	limit     int64
	written   int64
	truncated bool
}

func (w *limitedWriter) Write(p []byte) (int, error) {
	remain := w.limit - w.written
	if remain <= 0 {
		w.truncated = true
		return len(p), nil
	}
	if int64(len(p)) > remain {
		w.truncated = true
		_, _ = w.buf.Write(p[:remain])
		w.written += remain
		return len(p), nil
	}
	n, err := w.buf.Write(p)
	w.written += int64(n)
	return n, err
}
