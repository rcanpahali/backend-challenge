---
"backend-challenge": minor
---

Replace console logging with structured pino logger, suppress eslint warnings for console statements in favor of the new logger.

- Added `pino` as a dependency with `pino-pretty` for development output
- Created `src/logger.ts` as a singleton logger instance
- Uses `pino-pretty` in non-production environments, plain JSON in production
- Replaced all `console.log` / `console.error` calls across routes, jobs, and workers with structured log calls that include context fields (e.g. `taskId`, `taskType`)
- Added `LOG_LEVEL` to `.env`, `.env.example`, and the Zod config schema
