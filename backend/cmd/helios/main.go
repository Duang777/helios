package main

import (
	"log"
	"net/http"
	"os"

	"github.com/Duang777/helios/backend/internal/compiler"
	"github.com/Duang777/helios/backend/internal/httpapi"
	"github.com/Duang777/helios/backend/internal/runtime"
	"github.com/Duang777/helios/backend/internal/store"
)

func main() {
	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	server := httpapi.NewServer(compiler.New(), runtime.New(), store.NewMemoryStore())
	log.Printf("Helios API listening on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
