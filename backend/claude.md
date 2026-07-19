# Backend Claude Guide

Work in small slices. The backend should remain runnable with:

```bash
go test ./...
go run ./cmd/helios
```

Do not introduce a database, queue, or external AI provider until the in-memory contracts are stable. Provider integrations should be adapters behind existing compiler/runtime interfaces.

