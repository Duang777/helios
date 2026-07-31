package clifactory

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
	"gopkg.in/yaml.v3"
)

type Spec struct {
	Name        string    `json:"name" yaml:"name"`
	Version     string    `json:"version" yaml:"version"`
	Description string    `json:"description,omitempty" yaml:"description,omitempty"`
	BaseURL     string    `json:"baseUrl,omitempty" yaml:"baseUrl,omitempty"`
	Commands    []Command `json:"commands" yaml:"commands"`
}

type Command struct {
	Path       []string          `json:"path" yaml:"path"`
	SideEffect domain.SideEffect `json:"sideEffect" yaml:"sideEffect"`
	DryRun     bool              `json:"dryRun,omitempty" yaml:"dryRun,omitempty"`
	Args       []domain.CLIArgSpec `json:"args,omitempty" yaml:"args,omitempty"`
	Handler    string            `json:"handler" yaml:"handler"`
	Resource   string            `json:"resource,omitempty" yaml:"resource,omitempty"`
}

func LoadSpecFile(path string) (Spec, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Spec{}, err
	}
	return LoadSpec(raw)
}

func LoadSpec(raw []byte) (Spec, error) {
	var spec Spec
	if err := json.Unmarshal(raw, &spec); err != nil {
		return Spec{}, fmt.Errorf("parse factory spec: %w", err)
	}
	return NormalizeSpec(spec)
}

func ValidateSpec(spec Spec) error {
	_, err := NormalizeSpec(spec)
	return err
}

func NormalizeSpec(spec Spec) (Spec, error) {
	if spec.Name == "" {
		return Spec{}, fmt.Errorf("name is required")
	}
	for _, r := range spec.Name {
		if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
			return Spec{}, fmt.Errorf("name must be lowercase alphanumeric with hyphens")
		}
	}
	if spec.Name[0] < 'a' || spec.Name[0] > 'z' {
		return Spec{}, fmt.Errorf("name must start with a letter")
	}
	if spec.Version == "" {
		return Spec{}, fmt.Errorf("version is required")
	}
	if len(spec.Commands) == 0 {
		return Spec{}, fmt.Errorf("commands must not be empty")
	}
	seen := map[string]struct{}{}
	out := spec
	out.Commands = make([]Command, len(spec.Commands))
	copy(out.Commands, spec.Commands)
	for i := range out.Commands {
		cmd := &out.Commands[i]
		if len(cmd.Path) == 0 {
			return Spec{}, fmt.Errorf("commands[%d]: path required", i)
		}
		key := strings.Join(cmd.Path, " ")
		if _, ok := seen[key]; ok {
			return Spec{}, fmt.Errorf("duplicate command path %q", key)
		}
		seen[key] = struct{}{}
		switch cmd.SideEffect {
		case domain.SideEffectNone, domain.SideEffectRead, domain.SideEffectWrite:
		default:
			return Spec{}, fmt.Errorf("commands[%d]: invalid sideEffect", i)
		}
		switch cmd.Handler {
		case "storeGet", "storeList", "storeCreate", "httpGet", "httpList", "httpCreate":
		default:
			return Spec{}, fmt.Errorf("commands[%d]: unsupported handler %q", i, cmd.Handler)
		}
		if cmd.Resource == "" {
			cmd.Resource = cmd.Path[0]
		}
		if cmd.Handler == "storeGet" || cmd.Handler == "httpGet" {
			if !hasArg(cmd.Args, "--id") {
				return Spec{}, fmt.Errorf("commands[%d]: %s requires --id arg", i, cmd.Handler)
			}
		}
		if cmd.Handler == "storeCreate" || cmd.Handler == "httpCreate" {
			if !hasArg(cmd.Args, "--from-json") {
				return Spec{}, fmt.Errorf("commands[%d]: %s requires --from-json arg", i, cmd.Handler)
			}
			if cmd.SideEffect != domain.SideEffectWrite {
				return Spec{}, fmt.Errorf("commands[%d]: %s must be write", i, cmd.Handler)
			}
		}
		if strings.HasPrefix(cmd.Handler, "http") && strings.TrimSpace(out.BaseURL) == "" {
			return Spec{}, fmt.Errorf("commands[%d]: http handlers require baseUrl", i)
		}
	}
	sort.SliceStable(out.Commands, func(i, j int) bool {
		return strings.Join(out.Commands[i].Path, " ") < strings.Join(out.Commands[j].Path, " ")
	})
	return out, nil
}

func hasArg(args []domain.CLIArgSpec, name string) bool {
	for _, a := range args {
		if a.Name == name {
			return true
		}
	}
	return false
}

func (s Spec) ToIntrospect() domain.CLIIntrospect {
	cmds := make([]domain.CLICommandSpec, 0, len(s.Commands)+1)
	for _, c := range s.Commands {
		cmds = append(cmds, domain.CLICommandSpec{
			Path:       append([]string{}, c.Path...),
			SideEffect: c.SideEffect,
			DryRun:     c.DryRun,
			Args:       append([]domain.CLIArgSpec{}, c.Args...),
		})
	}
	cmds = append(cmds, domain.CLICommandSpec{
		Path:       []string{"introspect"},
		SideEffect: domain.SideEffectNone,
	})
	return domain.CLIIntrospect{
		Name:     s.Name,
		Version:  s.Version,
		Commands: cmds,
	}
}

// OpenAPI subset types (enough for Slice F).
type openAPIDoc struct {
	OpenAPI string                     `yaml:"openapi" json:"openapi"`
	Info    openAPIInfo                `yaml:"info" json:"info"`
	Servers []openAPIServer            `yaml:"servers" json:"servers"`
	Paths   map[string]openAPIPathItem `yaml:"paths" json:"paths"`
}

type openAPIInfo struct {
	Title   string `yaml:"title" json:"title"`
	Version string `yaml:"version" json:"version"`
}

type openAPIServer struct {
	URL string `yaml:"url" json:"url"`
}

type openAPIPathItem struct {
	Get  *openAPIOp `yaml:"get" json:"get"`
	Post *openAPIOp `yaml:"post" json:"post"`
	Put  *openAPIOp `yaml:"put" json:"put"`
}

type openAPIOp struct {
	OperationID string `yaml:"operationId" json:"operationId"`
	Summary     string `yaml:"summary" json:"summary"`
}

func FromOpenAPIFile(path, cliName string) (Spec, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Spec{}, err
	}
	return FromOpenAPI(raw, cliName)
}

func FromOpenAPI(raw []byte, cliName string) (Spec, error) {
	var doc openAPIDoc
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return Spec{}, fmt.Errorf("parse openapi: %w", err)
	}
	if !strings.HasPrefix(doc.OpenAPI, "3.") {
		return Spec{}, fmt.Errorf("only OpenAPI 3.x supported, got %q", doc.OpenAPI)
	}
	name := cliName
	if name == "" {
		name = sanitizeName(doc.Info.Title)
	}
	version := doc.Info.Version
	if version == "" {
		version = "0.1.0"
	}
	spec := Spec{
		Name:        name,
		Version:     version,
		Description: doc.Info.Title,
		Commands:    nil,
	}
	useHTTP := false
	if len(doc.Servers) > 0 && strings.TrimSpace(doc.Servers[0].URL) != "" {
		spec.BaseURL = strings.TrimRight(strings.TrimSpace(doc.Servers[0].URL), "/")
		useHTTP = true
	}

	for path, item := range doc.Paths {
		resource, idParam, ok := splitResourcePath(path)
		if !ok {
			continue
		}
		if item.Get != nil {
			if idParam {
				handler := "storeGet"
				if useHTTP {
					handler = "httpGet"
				}
				spec.Commands = append(spec.Commands, Command{
					Path:       []string{resource, "get"},
					SideEffect: domain.SideEffectRead,
					Args: []domain.CLIArgSpec{
						{Name: "--id", Type: "string", Required: true},
						{Name: "--output", Type: "string", Enum: []string{"json"}, Default: "json"},
					},
					Handler:  handler,
					Resource: resource,
				})
			} else {
				handler := "storeList"
				if useHTTP {
					handler = "httpList"
				}
				spec.Commands = append(spec.Commands, Command{
					Path:       []string{resource, "list"},
					SideEffect: domain.SideEffectRead,
					Handler:    handler,
					Resource:   resource,
				})
			}
		}
		if item.Post != nil && !idParam {
			handler := "storeCreate"
			if useHTTP {
				handler = "httpCreate"
			}
			spec.Commands = append(spec.Commands, Command{
				Path:       []string{resource, "create"},
				SideEffect: domain.SideEffectWrite,
				DryRun:     true,
				Args: []domain.CLIArgSpec{
					{Name: "--from-json", Type: "json", Required: true},
					{Name: "--dry-run", Type: "boolean"},
					{Name: "--output", Type: "string", Enum: []string{"json"}, Default: "json"},
				},
				Handler:  handler,
				Resource: resource,
			})
		}
	}
	if err := ValidateSpec(spec); err != nil {
		return Spec{}, err
	}
	return NormalizeSpec(spec)
}

func splitResourcePath(p string) (resource string, hasID bool, ok bool) {
	p = strings.Trim(p, "/")
	if p == "" {
		return "", false, false
	}
	parts := strings.Split(p, "/")
	if len(parts) == 1 {
		return parts[0], false, true
	}
	if len(parts) == 2 && (parts[1] == "{id}" || strings.HasPrefix(parts[1], "{")) {
		return parts[0], true, true
	}
	return "", false, false
}

func sanitizeName(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	var b strings.Builder
	lastDash := false
	for _, r := range title {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && b.Len() > 0 {
			b.WriteByte('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "generated-cli"
	}
	if out[0] < 'a' || out[0] > 'z' {
		return "cli-" + out
	}
	return out
}
