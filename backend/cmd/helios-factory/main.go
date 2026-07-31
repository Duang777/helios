package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Duang777/helios/backend/internal/clifactory"
	"github.com/Duang777/helios/backend/internal/clifactory/latheadapt"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "generate":
		cmdGenerate(os.Args[2:])
	case "from-openapi":
		cmdFromOpenAPI(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `helios-factory — generate Helios CLIs from factory spec / OpenAPI / Lathe

Usage:
  helios-factory generate --engine=helios --spec <factory.json> --out <dir>
  helios-factory generate --engine=lathe --openapi <file.yaml> --name <cli-name> --out <dir>
  helios-factory from-openapi --openapi <file.yaml> --name <cli-name> [--out spec.json]

Engines:
  helios  (default) lightweight FileDB/HTTP templates
  lathe   Lathe OpenAPI→Cobra (requires lathe on PATH; pin v0.5.2)

Design: docs/architecture/slice-f-cli-factory.md
        docs/architecture/slice-g-lathe-adapter.md
`)
}

func cmdGenerate(args []string) {
	fs := flag.NewFlagSet("generate", flag.ExitOnError)
	engine := fs.String("engine", "helios", "generator engine: helios|lathe")
	specPath := fs.String("spec", "", "path to factory JSON spec (engine=helios)")
	openapi := fs.String("openapi", "", "OpenAPI 3 file (engine=lathe)")
	name := fs.String("name", "", "CLI name (required for engine=lathe)")
	outDir := fs.String("out", "", "output directory")
	_ = fs.Parse(args)
	if *outDir == "" {
		fmt.Fprintln(os.Stderr, "--out is required")
		os.Exit(2)
	}
	switch strings.ToLower(strings.TrimSpace(*engine)) {
	case "", "helios":
		if *specPath == "" {
			fmt.Fprintln(os.Stderr, "--spec is required for engine=helios")
			os.Exit(2)
		}
		spec, err := clifactory.LoadSpecFile(*specPath)
		if err != nil {
			fatal(err)
		}
		res, err := clifactory.Generate(spec, *outDir)
		if err != nil {
			fatal(err)
		}
		fmt.Printf("generated %s → %s (engine=helios)\n", spec.Name, res.OutDir)
		fmt.Printf("  %s\n  %s\n  %s\n  %s\n", res.MainGo, res.SkillMD, res.ReadmeMD, res.FactoryJSON)
	case "lathe":
		if *openapi == "" || *name == "" {
			fmt.Fprintln(os.Stderr, "--openapi and --name are required for engine=lathe")
			os.Exit(2)
		}
		res, err := latheadapt.Generate(context.Background(), latheadapt.GenerateOptions{
			Name:        *name,
			OpenAPIPath: *openapi,
			OutDir:      *outDir,
		})
		if err != nil {
			fatal(err)
		}
		fmt.Printf("generated %s → %s (engine=lathe)\n", res.CLIName, res.OutDir)
		fmt.Printf("  lathe bin: %s\n  wrap src: %s\n  introspect: %s\n", res.LatheBinary, res.WrapBinary, res.Introspect)
		fmt.Printf("Build wrapper: (cd %s && go build -o bin/%s ./helios-wrap)\n", res.OutDir, res.CLIName)
	default:
		fmt.Fprintf(os.Stderr, "unknown engine %q (want helios|lathe)\n", *engine)
		os.Exit(2)
	}
}

func cmdFromOpenAPI(args []string) {
	fs := flag.NewFlagSet("from-openapi", flag.ExitOnError)
	openapi := fs.String("openapi", "", "OpenAPI 3 YAML/JSON file")
	name := fs.String("name", "", "CLI name (optional; derived from info.title)")
	out := fs.String("out", "", "write factory JSON to this path (default: stdout)")
	_ = fs.Parse(args)
	if *openapi == "" {
		fmt.Fprintln(os.Stderr, "--openapi is required")
		os.Exit(2)
	}
	spec, err := clifactory.FromOpenAPIFile(*openapi, *name)
	if err != nil {
		fatal(err)
	}
	raw, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		fatal(err)
	}
	raw = append(raw, '\n')
	if *out == "" {
		_, _ = os.Stdout.Write(raw)
		return
	}
	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil && filepath.Dir(*out) != "." {
		fatal(err)
	}
	if err := os.WriteFile(*out, raw, 0o644); err != nil {
		fatal(err)
	}
	fmt.Printf("wrote factory spec → %s (%s)\n", *out, spec.Name)
}

func fatal(err error) {
	fmt.Fprintf(os.Stderr, "helios-factory: %v\n", err)
	os.Exit(1)
}
