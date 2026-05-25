---
"backend-challenge": minor
---

Added GET `/workflow/:id/status` and GET `/workflow/:id/results` endpoints.

- Implemented `GET /workflow/:id/status` and `GET /workflow/:id/results` returning the status and parsed `finalResult`.
- Added `workflowRoutes.ts` and wired it into `index.ts` and the test app helper.
- Generated new test for the workflow.
