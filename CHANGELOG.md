# backend-challenge

## 1.1.0

### Minor Changes

- 1764718: Upgrade core (medium effort) dependencies to latest stable versions.
  - `express` v4 to v5, `marked` v15 to v18, `typeorm` v0.3 to v1.0
  - Switched SQLite driver from `sqlite3` to `better-sqlite3` (required by TypeORM v1)
  - Removed unused `bcrypt` and `jsonwebtoken` packages

- 0b64fd4: Implemented interdependent task support in workflows.
  - Extended the YAML workflow format with an optional `dependsOn: stepNumber` field; `WorkflowFactory` resolves it before moving on to the next task.
  - `TaskRunner` now merges the dependency's result data into the task payload as `dependencyOutput` before handing off to the job.
  - Added `TaskRepository` class for the query and unit/integration tests coverage.

- a9143b2: Implemented `ReportGenerationJob` and introduced a repository layer to keep db related concerns out of business logic.
  - Implemented `ReportGenerationJob` that aggregates outputs of all preceding tasks in a workflow into a structured report.
  - Introduced `TaskResultRepository` (TypeORM implementation) so jobs depend on a domain rather than `DataSource` directly.
  - Added `report_workflow.yml`. Renamed `example_workflow.yml` to `multi_task_workflow.yml`.

- c6038dd: Implemented workflow final result aggregation and task error tracking.
  - Added `finalResult` column to `Workflow` entity.
  - Restructured tests into `tests/integration/` and `tests/helpers/`, and move the vitest setup file.

- 6151ff5: Replace console logging with structured pino logger, suppress eslint warnings for console statements in favor of the new logger.
  - Added `pino` as a dependency with `pino-pretty` for development output
  - Created `src/logger.ts` as a singleton logger instance
  - Uses `pino-pretty` in non-production environments, plain JSON in production
  - Replaced all `console.log` / `console.error` calls across routes, jobs, and workers with structured log calls that include context fields (e.g. `taskId`, `taskType`)
  - Added `LOG_LEVEL` to `.env`, `.env.example`, and the Zod config schema

- 52d228e: Set up project tooling and quality-of-life infrastructure before feature work.
  - Added ESLint 9 flat config with typescript support, strict rules, and auto-fixable formatting rules
  - Added `zod`-based env validation in `src/config.ts` — all `process.env` access is now centralised, validated at startup, and typed
  - Fixed `dropSchema: true` being hardcoded — now controlled by `DB_DROP_SCHEMA` env var (defaults to `false`)
  - Added Vitest with `vitest.config.ts`
  - Added `npm` scripts: `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `spell`
  - Removed `yarn.lock` — project now uses npm exclusively

- 2732b4b: Added GET `/workflow/:id/status` and GET `/workflow/:id/results` endpoints.
  - Implemented `GET /workflow/:id/status` and `GET /workflow/:id/results` returning the status and parsed `finalResult`.
  - Added `workflowRoutes.ts` and wired it into `index.ts` and the test app helper.
  - Generated new test for the workflow.

### Patch Changes

- 9f3f9c3: Refactored the repository layer to use focused interfaces.
  - Added `ResultRepository` and `WorkflowRepository` and their related operations
  - Added `createTaskRunner` factory function to wire up the repositories
  - Moved workflow status derivation logic into `Workflow.deriveStatus()` on the entity

- 481cba6: Add CI pipeline with quality checks.
  - Split CI into separate steps: type check, lint, build, test, and security audit. Each step fails independently for faster feedback

- 8602002: Replace domain-specific `geoJson` field on `Task` with a generic `payload` field.
  - `Task.geoJson` renamed to `Task.payload`, jobs now pack whatever data they need into a JSON envelope

- 2e3288e: Add happy path tests to verify the system is functional end-to-end.
  - Add vitest integration tests covering `POST /analysis` and `TaskRunner` completing a full workflow
  - Configure vitest to use an in-memory SQLite database so tests are isolated and don't touch the dev DB

- e19b3a5: Implemented PolygonAreaJob and reorganized test structure.
  - Implemented `PolygonAreaJob` using `@turf/area` to calculate polygon area in square meters
  - Added `tests/unit/` and `tests/api/` directories for clearer separation of test types
  - Added `CONVENTIONS.md` documenting project structure, job conventions, and testing rules

- eb6faa8: Improve reliability using input validation, request logging, and graceful shutdown.
  - Added `pino-http` request logging middleware and graceful `SIGTERM`/`SIGINT` shutdown
  - Added Zod validation for the `POST /analysis` request body and YAML workflow definitions
  - Added `createdAt`/`updatedAt` timestamps to all entities; removed stale `ormconfig.json`
