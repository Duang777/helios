# Helios CLI Factory

Design: [`docs/architecture/slice-f-cli-factory.md`](../../docs/architecture/slice-f-cli-factory.md)

## Commands

```bash
cd backend

# Factory JSON → CLI sources
go run ./cmd/helios-factory generate \
  --spec ../examples/cli-factory/demo-inventory.factory.json \
  --out ./cmd/demo-inventory

# OpenAPI 3 subset → factory JSON
go run ./cmd/helios-factory from-openapi \
  --openapi ../examples/cli-factory/demo-inventory.openapi.yaml \
  --name demo-inventory \
  --out /tmp/demo-inventory.factory.json
```

## Accept

```bash
go test ./internal/clifactory/
../scripts/smoke-cli-factory.sh
```
