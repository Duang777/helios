package democli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Envelope struct {
	OK      bool           `json:"ok"`
	Command string         `json:"command"`
	Data    map[string]any `json:"data,omitempty"`
	Error   string         `json:"error,omitempty"`
	Meta    map[string]any `json:"meta,omitempty"`
}

func WriteJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func Fail(code int, command, msg string) {
	WriteJSON(Envelope{OK: false, Command: command, Error: msg, Meta: map[string]any{"cli": command}})
	os.Exit(code)
}

func OK(command string, data map[string]any, meta map[string]any) {
	if meta == nil {
		meta = map[string]any{}
	}
	WriteJSON(Envelope{OK: true, Command: command, Data: data, Meta: meta})
}

type FileDB struct {
	path string
	mu   sync.Mutex
}

func NewFileDB(name string) (*FileDB, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".helios", "demo-data")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &FileDB{path: filepath.Join(dir, name+".json")}, nil
}

func (d *FileDB) Load(v any) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	raw, err := os.ReadFile(d.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, v)
}

func (d *FileDB) Save(v any) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(d.path, raw, 0o644)
}

func FlagValue(args []string, name string) (string, bool) {
	for i := 0; i < len(args); i++ {
		if args[i] == name && i+1 < len(args) {
			return args[i+1], true
		}
		prefix := name + "="
		if len(args[i]) > len(prefix) && args[i][:len(prefix)] == prefix {
			return args[i][len(prefix):], true
		}
	}
	return "", false
}

func HasFlag(args []string, name string) bool {
	for _, a := range args {
		if a == name {
			return true
		}
	}
	return false
}

func RequireFlag(args []string, name, command string) string {
	v, ok := FlagValue(args, name)
	if !ok || v == "" {
		Fail(2, command, fmt.Sprintf("missing required flag %s", name))
	}
	return v
}
