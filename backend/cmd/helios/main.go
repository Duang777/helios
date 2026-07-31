package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/Duang777/helios/backend/internal/clirunner"
	"github.com/Duang777/helios/backend/internal/compile"
	"github.com/Duang777/helios/backend/internal/guiclient"
	"github.com/Duang777/helios/backend/internal/httpapi"
	"github.com/Duang777/helios/backend/internal/pi"
	"github.com/Duang777/helios/backend/internal/registry"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/schema"
	"github.com/Duang777/helios/backend/internal/store"
)

func main() {
	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	dataDir := os.Getenv("HELIOS_DATA_DIR")
	if dataDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatal(err)
		}
		dataDir = filepath.Join(home, ".helios")
	}

	st, err := store.NewFS(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	reg, err := registry.New(dataDir)
	if err != nil {
		log.Fatal(err)
	}

	if wfPath := os.Getenv("HELIOS_BOOTSTRAP_WORKFLOW"); wfPath != "" {
		wf, err := schema.LoadWorkflowFile(wfPath)
		if err != nil {
			log.Fatal(err)
		}
		if err := schema.SemanticValidate(wf); err != nil {
			log.Fatal(err)
		}
		if err := st.SaveWorkflow(wf); err != nil {
			log.Fatal(err)
		}
		log.Printf("bootstrapped workflow %s", wf.ID)
	}

	sidecarURL := os.Getenv("HELIOS_PI_SIDECAR_URL")
	if sidecarURL == "" {
		sidecarURL = "http://127.0.0.1:8091"
	}
	guiURL := os.Getenv("HELIOS_GUI_OPERATOR_URL")
	if guiURL == "" {
		guiURL = "http://127.0.0.1:8792"
	}
	piClient := pi.NewClient(sidecarURL)
	guiClient := guiclient.NewClient(guiURL)
	engine := runtime.NewEngine(st, clirunner.New(reg)).WithAI(piClient).WithGUI(guiClient)
	compiler := compile.New(piClient, func() ([]pi.CLISummary, error) {
		recs, err := reg.List()
		if err != nil {
			return nil, err
		}
		return compile.SummarizeCLIs(recs), nil
	})

	server := httpapi.NewServer(st, reg, engine, compiler)
	log.Printf("Helios API listening on http://localhost%s (dataDir=%s, pi=%s, gui=%s)", addr, dataDir, sidecarURL, guiURL)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
