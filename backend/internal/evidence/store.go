package evidence

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/Duang777/helios/backend/internal/domain"
)

var secretRE = regexp.MustCompile(`(?i)(token|secret|password|authorization|api[_-]?key)[=:\s]+([^\s"'\\]+)`)

type Store struct {
	runDir string
	seq    int
}

func NewStore(runDir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(runDir, "evidence"), 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(runDir, "steps"), 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(runDir, "approvals"), 0o755); err != nil {
		return nil, err
	}
	return &Store{runDir: runDir}, nil
}

func Redact(s string) string {
	return secretRE.ReplaceAllString(s, "$1=***")
}

func (s *Store) WriteCLI(ev domain.Evidence, stdout, stderr []byte) (domain.Evidence, error) {
	s.seq++
	prefix := filepath.Join("evidence", pad(s.seq)+"-"+ev.StepID)
	stdoutRel := prefix + ".stdout.txt"
	stderrRel := prefix + ".stderr.txt"
	metaRel := prefix + ".json"

	if err := os.WriteFile(filepath.Join(s.runDir, stdoutRel), []byte(Redact(string(stdout))), 0o644); err != nil {
		return ev, err
	}
	if err := os.WriteFile(filepath.Join(s.runDir, stderrRel), []byte(Redact(string(stderr))), 0o644); err != nil {
		return ev, err
	}
	ev.StdoutRef = stdoutRel
	ev.StderrRef = stderrRel
	raw, err := json.MarshalIndent(ev, "", "  ")
	if err != nil {
		return ev, err
	}
	if err := os.WriteFile(filepath.Join(s.runDir, metaRel), raw, 0o644); err != nil {
		return ev, err
	}
	return ev, nil
}

func (s *Store) WriteAI(ev domain.Evidence, payload []byte) (domain.Evidence, error) {
	s.seq++
	prefix := filepath.Join("evidence", pad(s.seq)+"-"+ev.StepID)
	outRel := prefix + ".jsonout.txt"
	metaRel := prefix + ".json"
	if err := os.WriteFile(filepath.Join(s.runDir, outRel), []byte(Redact(string(payload))), 0o644); err != nil {
		return ev, err
	}
	ev.StdoutRef = outRel
	raw, err := json.MarshalIndent(ev, "", "  ")
	if err != nil {
		return ev, err
	}
	if err := os.WriteFile(filepath.Join(s.runDir, metaRel), raw, 0o644); err != nil {
		return ev, err
	}
	return ev, nil
}

func (s *Store) WriteGUI(ev domain.Evidence, png []byte) (domain.Evidence, error) {
	s.seq++
	prefix := filepath.Join("evidence", pad(s.seq)+"-"+ev.StepID)
	shotRel := prefix + ".png"
	metaRel := prefix + ".json"
	if err := os.WriteFile(filepath.Join(s.runDir, shotRel), png, 0o644); err != nil {
		return ev, err
	}
	ev.ScreenshotRef = shotRel
	raw, err := json.MarshalIndent(ev, "", "  ")
	if err != nil {
		return ev, err
	}
	if err := os.WriteFile(filepath.Join(s.runDir, metaRel), raw, 0o644); err != nil {
		return ev, err
	}
	return ev, nil
}

func (s *Store) WriteStep(step domain.StepRun) error {
	raw, err := json.MarshalIndent(step, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.runDir, "steps", step.StepID+".json"), raw, 0o644)
}

func (s *Store) WriteApproval(a domain.ApprovalRecord) error {
	raw, err := json.MarshalIndent(a, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.runDir, "approvals", a.StepID+".json"), raw, 0o644)
}

func (s *Store) WriteRun(run domain.Run) error {
	raw, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.runDir, "run.json"), raw, 0o644)
}

func pad(n int) string {
	return strconv.Itoa(n + 1000)[1:]
}
