---
"backend-challenge": minor
---

Upgrade core (medium effort) dependencies to latest stable versions.

- `express` v4 to v5, `marked` v15 to v18, `typeorm` v0.3 to v1.0
- Switched SQLite driver from `sqlite3` to `better-sqlite3` (required by TypeORM v1)
- Removed unused `bcrypt` and `jsonwebtoken` packages
