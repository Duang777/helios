# demo-inventory

Demo inventory platform CLI (factory-generated HTTP client)

Factory-generated Helios CLI. Prefer commands from `introspect`.

## Commands

- `items create` (write)
- `items get` (read)
- `items list` (read)

## Notes

- Write commands support `--dry-run` (exit 9 on success).
- Output is JSON envelope `{ok,command,data,error,meta}`.
- Default API base URL: `http://127.0.0.1:8795` (override with env `DEMO_INVENTORY_BASE_URL`).
