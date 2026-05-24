---
"backend-challenge": patch
---

Add happy path tests to verify the system is functional end-to-end.

- Add vitest integration tests covering `POST /analysis` and `TaskRunner` completing a full workflow
- Configure vitest to use an in-memory SQLite database so tests are isolated and don't touch the dev DB
