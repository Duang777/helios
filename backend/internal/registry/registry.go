package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
)

type Registry struct {
	dir string
}

func New(dataDir string) (*Registry, error) {
	dir := filepath.Join(dataDir, "registry", "clis")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Registry{dir: dir}, nil
}

func (r *Registry) Register(name, binaryPath string) (domain.RegisteredCLI, error) {
	abs, err := filepath.Abs(binaryPath)
	if err != nil {
		return domain.RegisteredCLI{}, err
	}
	if _, err := os.Stat(abs); err != nil {
		return domain.RegisteredCLI{}, fmt.Errorf("cli binary not found: %w", err)
	}
	out, err := exec.Command(abs, "introspect").Output()
	if err != nil {
		return domain.RegisteredCLI{}, fmt.Errorf("introspect failed: %w", err)
	}
	var intro domain.CLIIntrospect
	if err := json.Unmarshal(out, &intro); err != nil {
		return domain.RegisteredCLI{}, fmt.Errorf("invalid introspect json: %w", err)
	}
	if intro.Name == "" {
		intro.Name = name
	}
	if name != "" && intro.Name != name {
		return domain.RegisteredCLI{}, fmt.Errorf("introspect name %q does not match %q", intro.Name, name)
	}
	if intro.Version == "" || len(intro.Commands) == 0 {
		return domain.RegisteredCLI{}, fmt.Errorf("introspect missing version/commands")
	}
	rec := domain.RegisteredCLI{
		Name:       intro.Name,
		Version:    intro.Version,
		Path:       abs,
		Introspect: intro,
	}
	raw, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return domain.RegisteredCLI{}, err
	}
	path := filepath.Join(r.dir, intro.Name+".json")
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		return domain.RegisteredCLI{}, err
	}
	return rec, nil
}

func (r *Registry) Get(name string) (domain.RegisteredCLI, error) {
	raw, err := os.ReadFile(filepath.Join(r.dir, name+".json"))
	if err != nil {
		return domain.RegisteredCLI{}, fmt.Errorf("cli %q not registered", name)
	}
	var rec domain.RegisteredCLI
	if err := json.Unmarshal(raw, &rec); err != nil {
		return domain.RegisteredCLI{}, err
	}
	return rec, nil
}

func (r *Registry) List() ([]domain.RegisteredCLI, error) {
	entries, err := os.ReadDir(r.dir)
	if err != nil {
		return nil, err
	}
	out := make([]domain.RegisteredCLI, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		rec, err := r.Get(strings.TrimSuffix(e.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, nil
}

func Allowlisted(rec domain.RegisteredCLI, argv []string) error {
	if len(argv) == 0 {
		return fmt.Errorf("empty argv")
	}
	for _, cmd := range rec.Introspect.Commands {
		if prefixMatch(cmd.Path, argv) {
			return nil
		}
	}
	return fmt.Errorf("command %v is not allowlisted for %s", argv, rec.Name)
}

func prefixMatch(path, argv []string) bool {
	if len(argv) < len(path) {
		return false
	}
	for i := range path {
		if argv[i] != path[i] {
			return false
		}
	}
	return true
}
