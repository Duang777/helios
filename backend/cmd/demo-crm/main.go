package main

import (
	"fmt"
	"os"
	"time"

	"github.com/Duang777/helios/backend/internal/democli"
	"github.com/Duang777/helios/backend/internal/domain"
)

const version = "1.0.0"

type storeData struct {
	Leads map[string]map[string]any `json:"leads"`
}

func main() {
	if len(os.Args) < 2 {
		democli.Fail(2, "demo-crm", "usage: demo-crm <command>")
	}
	switch os.Args[1] {
	case "--version", "version":
		fmt.Println(version)
		return
	case "introspect":
		writeIntrospect()
		return
	case "leads":
		handleLeads(os.Args[2:])
		return
	default:
		democli.Fail(2, "demo-crm", "unknown command")
	}
}

func writeIntrospect() {
	doc := domain.CLIIntrospect{
		Name:    "demo-crm",
		Version: version,
		Commands: []domain.CLICommandSpec{
			{Path: []string{"leads", "get"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "--id", Type: "string", Required: true},
				{Name: "--output", Type: "string", Enum: []string{"json", "text"}, Default: "json"},
			}},
			{Path: []string{"leads", "list"}, SideEffect: domain.SideEffectRead},
			{Path: []string{"leads", "create"}, SideEffect: domain.SideEffectWrite, DryRun: true, Args: []domain.CLIArgSpec{
				{Name: "--id", Type: "string", Required: true},
				{Name: "--title", Type: "string", Required: true},
				{Name: "--dry-run", Type: "boolean"},
			}},
			{Path: []string{"leads", "update"}, SideEffect: domain.SideEffectWrite, DryRun: true, Args: []domain.CLIArgSpec{
				{Name: "--id", Type: "string", Required: true},
				{Name: "--title", Type: "string"},
				{Name: "--dry-run", Type: "boolean"},
			}},
			{Path: []string{"introspect"}, SideEffect: domain.SideEffectNone},
		},
	}
	democli.WriteJSON(doc)
}

func handleLeads(args []string) {
	if len(args) == 0 {
		democli.Fail(2, "leads", "missing subcommand")
	}
	db, err := democli.NewFileDB("demo-crm")
	if err != nil {
		democli.Fail(1, "leads", err.Error())
	}
	data := storeData{Leads: map[string]map[string]any{}}
	_ = db.Load(&data)
	if data.Leads == nil {
		data.Leads = map[string]map[string]any{}
	}
	if ensureSeed(&data) {
		_ = db.Save(data)
	}

	switch args[0] {
	case "get":
		id := democli.RequireFlag(args[1:], "--id", "leads.get")
		lead, ok := data.Leads[id]
		if !ok {
			democli.Fail(3, "leads.get", "lead not found")
		}
		democli.OK("leads.get", lead, map[string]any{"cli": "demo-crm", "version": version})
	case "list":
		items := make([]map[string]any, 0, len(data.Leads))
		for _, v := range data.Leads {
			items = append(items, v)
		}
		democli.OK("leads.list", map[string]any{"items": items}, map[string]any{"cli": "demo-crm", "version": version})
	case "create":
		id := democli.RequireFlag(args[1:], "--id", "leads.create")
		title := democli.RequireFlag(args[1:], "--title", "leads.create")
		lead := map[string]any{"id": id, "title": title, "updatedAt": time.Now().UTC().Format(time.RFC3339)}
		if democli.HasFlag(args[1:], "--dry-run") {
			democli.OK("leads.create", lead, map[string]any{"cli": "demo-crm", "dryRun": true})
			os.Exit(9)
		}
		data.Leads[id] = lead
		if err := db.Save(data); err != nil {
			democli.Fail(1, "leads.create", err.Error())
		}
		democli.OK("leads.create", lead, map[string]any{"cli": "demo-crm", "version": version})
	case "update":
		id := democli.RequireFlag(args[1:], "--id", "leads.update")
		lead, ok := data.Leads[id]
		if !ok {
			democli.Fail(3, "leads.update", "lead not found")
		}
		if title, ok := democli.FlagValue(args[1:], "--title"); ok {
			lead["title"] = title
		}
		lead["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
		if democli.HasFlag(args[1:], "--dry-run") {
			democli.OK("leads.update", lead, map[string]any{"cli": "demo-crm", "dryRun": true})
			os.Exit(9)
		}
		data.Leads[id] = lead
		if err := db.Save(data); err != nil {
			democli.Fail(1, "leads.update", err.Error())
		}
		democli.OK("leads.update", lead, map[string]any{"cli": "demo-crm", "version": version})
	default:
		democli.Fail(2, "leads", "unknown subcommand")
	}
}

func ensureSeed(data *storeData) bool {
	if _, ok := data.Leads["L-123"]; ok {
		return false
	}
	data.Leads["L-123"] = map[string]any{
		"id":     "L-123",
		"title":  "Acme deal",
		"amount": 12000,
		"owner":  "demo",
	}
	return true
}
