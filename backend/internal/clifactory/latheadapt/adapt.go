package latheadapt

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Duang777/helios/backend/internal/domain"
)

// Catalog is the subset of Lathe `commands --json` we map to Helios introspect.
type Catalog struct {
	CLI struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"cli"`
	Commands []CatalogCommand `json:"commands"`
}

type CatalogCommand struct {
	Kind    string         `json:"kind"`
	Path    []string       `json:"path"`
	Summary string         `json:"summary"`
	HTTP    *CatalogHTTP   `json:"http"`
	Body    *CatalogBody   `json:"body"`
	Flags   []CatalogFlag  `json:"flags"`
}

type CatalogHTTP struct {
	Method       string `json:"method"`
	PathTemplate string `json:"path_template"`
}

type CatalogBody struct {
	Required bool `json:"required"`
}

type CatalogFlag struct {
	Name     string `json:"name"`
	Required bool   `json:"required"`
	Type     string `json:"type"`
}

// IntrospectFromCatalogJSON maps Lathe catalog JSON to Helios CLIIntrospect.
func IntrospectFromCatalogJSON(raw []byte) (domain.CLIIntrospect, error) {
	var cat Catalog
	if err := json.Unmarshal(raw, &cat); err != nil {
		return domain.CLIIntrospect{}, fmt.Errorf("parse lathe catalog: %w", err)
	}
	return IntrospectFromCatalog(cat)
}

func IntrospectFromCatalog(cat Catalog) (domain.CLIIntrospect, error) {
	name := strings.TrimSpace(cat.CLI.Name)
	if name == "" {
		return domain.CLIIntrospect{}, fmt.Errorf("lathe catalog missing cli.name")
	}
	version := strings.TrimSpace(cat.CLI.Version)
	if version == "" || version == "dev" {
		version = "0.1.0"
	}
	out := domain.CLIIntrospect{
		Name:     name,
		Version:  version,
		Commands: nil,
	}
	for _, c := range cat.Commands {
		if c.Kind != "operation" {
			continue
		}
		if len(c.Path) == 0 {
			continue
		}
		cmd := domain.CLICommandSpec{
			Path:       append([]string{}, c.Path...),
			SideEffect: sideEffectFromHTTP(c.HTTP),
		}
		if cmd.SideEffect == domain.SideEffectWrite {
			cmd.DryRun = true
			cmd.Args = append(cmd.Args, domain.CLIArgSpec{Name: "--dry-run", Type: "boolean"})
		}
		if c.Body != nil && c.Body.Required {
			cmd.Args = append(cmd.Args, domain.CLIArgSpec{Name: "--file", Type: "json", Required: true})
		}
		for _, f := range c.Flags {
			name := normalizeFlag(f.Name)
			if name == "" || hasArg(cmd.Args, name) {
				continue
			}
			cmd.Args = append(cmd.Args, domain.CLIArgSpec{
				Name:     name,
				Type:     mapFlagType(f.Type),
				Required: f.Required,
			})
		}
		out.Commands = append(out.Commands, cmd)
	}
	out.Commands = append(out.Commands, domain.CLICommandSpec{
		Path:       []string{"introspect"},
		SideEffect: domain.SideEffectNone,
	})
	if len(out.Commands) < 2 {
		return domain.CLIIntrospect{}, fmt.Errorf("lathe catalog has no operation commands")
	}
	return out, nil
}

func sideEffectFromHTTP(h *CatalogHTTP) domain.SideEffect {
	if h == nil {
		return domain.SideEffectRead
	}
	switch strings.ToUpper(h.Method) {
	case "POST", "PUT", "PATCH", "DELETE":
		return domain.SideEffectWrite
	default:
		return domain.SideEffectRead
	}
}

func normalizeFlag(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	if strings.HasPrefix(name, "--") {
		return name
	}
	if strings.HasPrefix(name, "-") && !strings.HasPrefix(name, "--") {
		return name
	}
	return "--" + strings.TrimPrefix(name, "-")
}

func mapFlagType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "int", "integer", "number", "float":
		return "number"
	case "bool", "boolean":
		return "boolean"
	case "json", "object":
		return "json"
	default:
		return "string"
	}
}

func hasArg(args []domain.CLIArgSpec, name string) bool {
	for _, a := range args {
		if a.Name == name {
			return true
		}
	}
	return false
}
