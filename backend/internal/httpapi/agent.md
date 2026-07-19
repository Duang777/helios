# HTTP API Agent Guide

HTTP API is the boundary for validation and response shape stability.

Use structured error responses:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

