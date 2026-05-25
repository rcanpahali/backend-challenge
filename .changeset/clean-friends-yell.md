---
"backend-challenge": patch
---

Refactored the repository layer to use focused interfaces.

- Added `ResultRepository` and `WorkflowRepository` and their related operations
- Added `createTaskRunner` factory function to wire up the repositories
- Moved workflow status derivation logic into `Workflow.deriveStatus()` on the entity
