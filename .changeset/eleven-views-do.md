---
"backend-challenge": minor
---

Implemented interdependent task support in workflows.

- Extended the YAML workflow format with an optional `dependsOn: stepNumber` field; `WorkflowFactory` resolves it before moving on to the next task.
- `TaskRunner` now merges the dependency's result data into the task payload as `dependencyOutput` before handing off to the job.
- Added `TaskRepository` class for the query and unit/integration tests coverage.
