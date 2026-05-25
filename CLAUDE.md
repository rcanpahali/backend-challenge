# Backend Coding Challenge — Agent Guide

## Project Overview

TypeScript/Express.js backend that demonstrates asynchronous task execution via a workflow engine. Uses TypeORM with SQLite, a background polling worker, and YAML-driven workflow definitions.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** TypeORM (SQLite)
- **YAML parsing:** `js-yaml`
- **Logging:** `pino` / `pino-http` (`src/logger.ts`)
- **Geo library:** `@turf/area` (used in `PolygonAreaJob`)

## Key Concepts

### Entities (`src/models/`)

- `Task` — unit of work with `taskType`, `status`, `stepNumber`, `payload`, `clientId`, `resultId`, `dependency`, `workflow`
- `Workflow` — groups tasks; has `status`, `clientId`, `tasks[]`, `finalResult`
- `Result` — stores job output; has `taskId`, `data` (JSON string)

### Status enums

- `TaskStatus` (in `src/types/TaskStatus.ts`): `queued | in_progress | completed | failed`
- `WorkflowStatus` (in `src/workflows/WorkflowFactory.ts`): `initial | in_progress | completed | failed`

### Job system (`src/jobs/`)

- `Job` interface: `run(task: Task): Promise<unknown>`
- `JobFactory.ts`: maps `taskType` string → `Job` instance via `getJobForTaskType()`
- Existing jobs: `DataAnalysisJob` (`analysis`), `EmailNotificationJob` (`notification`), `PolygonAreaJob` (`polygon_area`), `ReportGenerationJob` (`report`)
- **To add a job:** create the class, register it in `jobMap` in `JobFactory.ts`
- **Jobs that need DB access** must depend on a repository interface (e.g. `ITaskResultRepository`), not on `DataSource` directly — see `src/repositories/`
- `src/jobs/parsePayload.ts` — shared helper to safely parse `task.payload` JSON

### Execution flow

1. `POST /analysis` → `analysisRoutes.ts` → `WorkflowFactory.createWorkflowFromYAML()` creates `Workflow` + `Task` rows with status `queued`
2. `taskWorker.ts` polls every 5 s for `queued` tasks; skips tasks whose dependency is not yet `completed`
3. `TaskRunner.run()` sets task `in_progress`, calls `job.run(task)`, saves a `Result`, sets task `completed`, then re-evaluates workflow status via `WorkflowRepository.syncStatus()`
4. `syncStatus()` aggregates all task results into `workflow.finalResult` when the workflow reaches `completed` or `failed`

### API Routes

| Method | Path                    | Description                                                  |
| ------ | ----------------------- | ------------------------------------------------------------ |
| `POST` | `/analysis`             | Submit a new workflow; returns `workflowId`                  |
| `GET`  | `/workflow/:id/status`  | Poll workflow progress (`completedTasks` / `totalTasks`)     |
| `GET`  | `/workflow/:id/results` | Fetch `finalResult` once workflow is `completed` or `failed` |

### YAML workflow format (`src/workflows/example_workflow.yml`)

```yaml
name: "example_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
    dependsOn: 1 # optional — waits for stepNumber 1 to complete
```

`report_workflow.yml` extends this with a `report` step (stepNumber: 3, dependsOn: 2).

`dependsOn` is optional. When set, `WorkflowFactory` wires the matching task as the `dependency`, and `TaskRunner` injects that task's result into the dependent task's payload as `dependencyOutput` before running its job.

## Conventions

- All new routes go in `src/routes/`, wired in `src/index.ts`
- All new jobs go in `src/jobs/`, registered in `JobFactory.ts`
- Entity changes require TypeORM migration or `synchronize: true` in `data-source.ts`
- `Result.data` is always a JSON string — use `JSON.stringify` / `JSON.parse`
- Task `output` is stored via a `Result` row linked by `task.resultId`
- Task input data is stored in `task.payload` (JSON string) — not a `geoJson` column; always `JSON.stringify` / `JSON.parse`
- All new repositories implement an interface in `src/repositories/I*.ts` and are injected via constructor

## Running the App

```bash
npm install
npm start          # ts-node, starts server + worker
# or
npx tsc && node dist/index.js
```

Test the analysis endpoint:

```bash
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client123","geoJson":{"type":"Polygon","coordinates":[[[-63.62,-10.31],[-63.62,-10.37],[-63.61,-10.37],[-63.61,-10.31],[-63.62,-10.31]]]}}'
```

Poll status and results:

```bash
curl http://localhost:3000/workflow/<workflowId>/status
curl http://localhost:3000/workflow/<workflowId>/results
```

## Testing

- The project uses **vitest** for testing.
- Tests live under `tests/`:
  - `tests/unit/` — isolated unit tests (jobs, workers)
  - `tests/integration/api/` — API endpoint integration tests
  - `tests/integration/workflows/` — workflow factory and execution integration tests
  - `tests/helpers/` — shared test utilities and app setup
  - `tests/setup.ts` — global vitest setup
- Run all tests with `npm test` and `npm run lint` after every architectural change or new feature implementation.

## Versioning & Changesets

- The project uses **@changesets/cli** for versioning.
- Changesets live under `.changeset/` for notable changes before merging.
- Always check whats changed with `git diff` before creating a changeset
- Use natural and simple language in the changeset description, no need to explain every detail. Keep it short and simple, focus on the impact of the change.
- Use past-tense action verbs: prefer **"implemented"** and **"added"** over "adds", "implements", "introduces", etc.
- Use human-id like file names.
- Use the following format for the changeset description:

```
---
"package-name": patch|minor|major
---
<Short summary of the change (1-2 sentences)>

- A bullet point summary of the changes, including any relevant context.
```

## Commit Messages

Follow the Conventional Commits format:

```
<type>(<optional scope>): <short description>
```

| Type       | When to use                                                    |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new feature visible to users or consumers of the API         |
| `fix`      | A bug fix                                                      |
| `chore`    | Maintenance tasks: dependency updates, tooling, config changes |
| `docs`     | Documentation-only changes (README, comments, guides)          |
| `style`    | Formatting, whitespace, semicolons — no logic change           |
| `refactor` | Code restructuring without feature addition or bug fix         |

A common order: feat > fix > refactor > chore > style > docs.

---
