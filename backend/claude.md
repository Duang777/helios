# Backend Claude Guide

Work in small slices. The backend should remain runnable with:

```bash
go test ./...
go run ./cmd/helios
./scripts/smoke-lead-sync.sh
```

Slice A control plane owns workflow YAML validation, CLI registry/execution, DAG runtime, approvals, and evidence on the filesystem under `HELIOS_DATA_DIR` (default `~/.helios`).

Do not introduce a database, queue, or external AI provider until the CLI+approval path is stable. Pi sidecar comes after Slice A.
