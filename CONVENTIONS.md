# Project Conventions

## Code Style

- TypeScript strict mode is enabled — no implicit `any`, no unchecked nulls
- Prettier enforces formatting; ESLint enforces correctness — run `npm run lint` before committing
- No inline comments unless the _why_ is non-obvious (not the _what_)
- No multi-line comment blocks or docstrings

## File Structure

| Concern              | Location              |
| -------------------- | --------------------- |
| Route handlers       | `src/routes/`         |
| Job classes          | `src/jobs/`           |
| Repository interfaces & implementations | `src/repositories/` |
| Shared types & enums | `src/types/`          |
| Entity models        | `src/models/`         |
| Worker logic         | `src/workers/`        |
| Workflow logic       | `src/workflows/`      |
| Shared helpers       | co-located with consumers |
| Unit tests           | `tests/unit/`         |
| API/integration tests | `tests/api/`         |
| Test utilities       | `src/test/`           |

## Jobs

- Every job implements the `Job` interface (`src/jobs/Job.ts`)
- Register new jobs in the `jobMap` in `src/jobs/JobFactory.ts`
- Use `parsePayload<T>(task)` to extract typed data from `task.payload` — never call `JSON.parse` directly in a job
- Throwing an error from `job.run()` is sufficient to mark a task failed — `TaskRunner` handles the status update
- Jobs that need DB access must depend on a repository interface from `src/repositories/`, not on `DataSource` directly — wire the concrete implementation in `JobFactory.ts`

## Entities & Persistence

- `Result.data` is always a JSON string — use `JSON.stringify` / `JSON.parse` at the boundary
- Entity changes require either a TypeORM migration or `synchronize: true` in `data-source.ts` (dev only)
- New routes must be wired up in `src/index.ts`

## Error Handling

- Re-thrown errors must attach the original as `cause`: `new Error("...", { cause: e })`
- Validate at system boundaries (route handlers, job entry points); trust internal code

## Testing

- Framework: **vitest** — run with `npm test`; run lint with `npm run lint`
- **Every new feature or job must include a happy path test**
- `tests/unit/` — no DB, no HTTP; instantiate classes directly with a minimal `Task` object
- `tests/api/` — full request-to-DB flow; use `AppDataSource` + `TaskRunner` as in `analysis.test.ts`
- Mirror the `src/` folder structure inside each test directory (e.g. `tests/unit/jobs/`, `tests/api/routes/`)
- Use `beforeAll` / `afterAll` from `src/test/setup.ts` for DB lifecycle in API tests

## Versioning

- Use `@changesets/cli` for notable changes — changesets live under `.changeset/`
- File names use human-id slugs (e.g. `add-polygon-area-job.md`)
- Format: `patch` / `minor` / `major` + 1–2 sentence summary + bullet points

## Commit Messages

Follow Conventional Commits: `<type>(<scope>): <description>`

| Type       | When                                        |
| ---------- | ------------------------------------------- |
| `feat`     | New user-visible feature or API change      |
| `fix`      | Bug fix                                     |
| `chore`    | Tooling, deps, config                       |
| `docs`     | Docs/comments only                          |
| `style`    | Formatting, no logic change                 |
| `refactor` | Restructuring without feature or bug change |
