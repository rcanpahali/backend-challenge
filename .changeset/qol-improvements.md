---
"backend-challenge": patch
---

Improve reliability using input validation, request logging, and graceful shutdown.

- Added `pino-http` request logging middleware and graceful `SIGTERM`/`SIGINT` shutdown
- Added Zod validation for the `POST /analysis` request body and YAML workflow definitions
- Added `createdAt`/`updatedAt` timestamps to all entities; removed stale `ormconfig.json`
