---
"backend-challenge": minor
---

Set up project tooling and quality-of-life infrastructure before feature work.

- Added ESLint 9 flat config with typescript support, strict rules, and auto-fixable formatting rules
- Added `zod`-based env validation in `src/config.ts` — all `process.env` access is now centralised, validated at startup, and typed
- Fixed `dropSchema: true` being hardcoded — now controlled by `DB_DROP_SCHEMA` env var (defaults to `false`)
- Added Vitest with `vitest.config.ts`
- Added `npm` scripts: `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `spell`
- Removed `yarn.lock` — project now uses npm exclusively
