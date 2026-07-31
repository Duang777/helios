package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/Duang777/helios/backend/internal/democli"
	"github.com/Duang777/helios/backend/internal/domain"
)

const version = "1.0.0"

type storeData struct {
	POs map[string]map[string]any `json:"pos"`
}

func main() {
	if len(os.Args) < 2 {
		democli.Fail(2, "demo-erp", "usage: demo-erp <command>")
	}
	switch os.Args[1] {
	case "--version", "version":
		fmt.Println(version)
		return
	case "introspect":
		writeIntrospect()
		return
	case "po":
		handlePO(os.Args[2:])
		return
	default:
		democli.Fail(2, "demo-erp", "unknown command")
	}
}

func writeIntrospect() {
	doc := domain.CLIIntrospect{
		Name:    "demo-erp",
		Version: version,
		Commands: []domain.CLICommandSpec{
			{Path: []string{"po", "get"}, SideEffect: domain.SideEffectRead, Args: []domain.CLIArgSpec{
				{Name: "--id", Type: "string", Required: true},
			}},
			{Path: []string{"po", "create"}, SideEffect: domain.SideEffectWrite, DryRun: true, Args: []domain.CLIArgSpec{
				{Name: "--from-json", Type: "json", Required: true},
				{Name: "--dry-run", Type: "boolean"},
				{Name: "--needs-gui", Type: "boolean"},
				{Name: "--confirm-url", Type: "string"},
				{Name: "--output", Type: "string", Enum: []string{"json"}, Default: "json"},
			}},
			{Path: []string{"introspect"}, SideEffect: domain.SideEffectNone},
		},
	}
	democli.WriteJSON(doc)
}

func handlePO(args []string) {
	if len(args) == 0 {
		democli.Fail(2, "po", "missing subcommand")
	}
	db, err := democli.NewFileDB("demo-erp")
	if err != nil {
		democli.Fail(1, "po", err.Error())
	}
	data := storeData{POs: map[string]map[string]any{}}
	_ = db.Load(&data)
	if data.POs == nil {
		data.POs = map[string]map[string]any{}
	}

	switch args[0] {
	case "get":
		id := democli.RequireFlag(args[1:], "--id", "po.get")
		po, ok := data.POs[id]
		if !ok {
			democli.Fail(3, "po.get", "po not found")
		}
		democli.OK("po.get", po, map[string]any{"cli": "demo-erp", "version": version})
	case "create":
		raw := democli.RequireFlag(args[1:], "--from-json", "po.create")
		var lead map[string]any
		if err := json.Unmarshal([]byte(raw), &lead); err != nil {
			democli.Fail(2, "po.create", "invalid --from-json")
		}
		leadID := firstString(lead, "id", "sourceLeadId", "leadId", "lead_id")
		if leadID == "" {
			democli.Fail(2, "po.create", "lead id missing in --from-json (id|sourceLeadId|leadId)")
		}
		poID := "PO-" + leadID
		needsGUI := democli.HasFlag(args[1:], "--needs-gui") || os.Getenv("DEMO_ERP_NEEDS_GUI") == "1"
		confirmURL, _ := democli.FlagValue(args[1:], "--confirm-url")
		if needsGUI && confirmURL == "" {
			base := strings.TrimRight(os.Getenv("HELIOS_GUI_OPERATOR_URL"), "/")
			if base == "" {
				base = "http://127.0.0.1:8792"
			}
			confirmURL = base + "/fixture/confirm.html"
		}
		title := firstString(lead, "title", "vendor", "company")
		po := map[string]any{
			"id":        poID,
			"leadId":    leadID,
			"title":     title,
			"amount":    lead["amount"],
			"status":    "draft",
			"needs_gui": needsGUI,
			"createdAt": time.Now().UTC().Format(time.RFC3339),
		}
		if v, ok := lead["vendor"]; ok {
			po["vendor"] = v
		}
		if v, ok := lead["currency"]; ok {
			po["currency"] = v
		}
		if v, ok := lead["note"]; ok {
			po["note"] = v
		}
		if confirmURL != "" {
			po["confirmUrl"] = confirmURL
		}
		if democli.HasFlag(args[1:], "--dry-run") {
			po["status"] = "dry-run"
			democli.OK("po.create", po, map[string]any{"cli": "demo-erp", "dryRun": true, "version": version})
			os.Exit(9)
		}
		po["status"] = "created"
		data.POs[poID] = po
		if err := db.Save(data); err != nil {
			democli.Fail(1, "po.create", err.Error())
		}
		democli.OK("po.create", po, map[string]any{"cli": "demo-erp", "version": version})
	default:
		democli.Fail(2, "po", "unknown subcommand")
	}
}

func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}
