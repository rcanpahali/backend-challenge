---
"backend-challenge": minor
---

Implemented `ReportGenerationJob` and introduced a repository layer to keep db related concerns out of business logic.

- Implemented `ReportGenerationJob` that aggregates outputs of all preceding tasks in a workflow into a structured report.
- Introduced `TaskResultRepository` (TypeORM implementation) so jobs depend on a domain rather than `DataSource` directly.
- Added `report_workflow.yml`. Renamed `example_workflow.yml` to `multi_task_workflow.yml`.
