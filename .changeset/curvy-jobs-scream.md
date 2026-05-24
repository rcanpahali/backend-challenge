---
"backend-challenge": patch
---

Add CI pipeline with quality checks.

- Split CI into separate steps: type check, lint, build, test, and security audit. Each step fails independently for faster feedback
