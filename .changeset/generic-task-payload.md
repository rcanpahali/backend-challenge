---
"backend-challenge": patch
---

Replace domain-specific `geoJson` field on `Task` with a generic `payload` field.

- `Task.geoJson` renamed to `Task.payload`, jobs now pack whatever data they need into a JSON envelope
