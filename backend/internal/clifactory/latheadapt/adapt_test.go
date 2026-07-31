package latheadapt_test

import (
	"testing"

	"github.com/Duang777/helios/backend/internal/clifactory/latheadapt"
	"github.com/Duang777/helios/backend/internal/domain"
)

func TestIntrospectFromCatalogJSON(t *testing.T) {
	raw := []byte(`{
  "cli": {"name": "demo-inventory-lathe", "version": "dev"},
  "commands": [
    {
      "kind": "operation",
      "path": ["default", "list-items"],
      "http": {"method": "GET", "path_template": "/items"}
    },
    {
      "kind": "operation",
      "path": ["default", "create-item"],
      "http": {"method": "POST", "path_template": "/items"},
      "body": {"required": true}
    },
    {
      "kind": "group",
      "path": ["default"]
    }
  ]
}`)
	intro, err := latheadapt.IntrospectFromCatalogJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if intro.Name != "demo-inventory-lathe" || intro.Version != "0.1.0" {
		t.Fatalf("intro=%+v", intro)
	}
	var list, create, introspect *domain.CLICommandSpec
	for i := range intro.Commands {
		c := &intro.Commands[i]
		key := join(c.Path)
		switch key {
		case "default list-items":
			list = c
		case "default create-item":
			create = c
		case "introspect":
			introspect = c
		}
	}
	if list == nil || list.SideEffect != domain.SideEffectRead {
		t.Fatalf("list=%v", list)
	}
	if create == nil || create.SideEffect != domain.SideEffectWrite || !create.DryRun {
		t.Fatalf("create=%v", create)
	}
	if introspect == nil {
		t.Fatal("missing introspect")
	}
}

func join(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " "
		}
		out += p
	}
	return out
}
