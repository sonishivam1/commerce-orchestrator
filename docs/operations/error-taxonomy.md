# Error Taxonomy

Errors during a run are one of three types (`ErrorType` in `@cdo/shared`). The type decides what the worker does.

## `VALIDATION`
- **Cause**: bad data, missing required fields, failed Zod validation, an unresolvable foreign-key reference.
- **Action**: skip the item, append it to `MigrationRun.failedItems[]`, keep going.
- **Impact**: the wave stays healthy.

## `TRANSIENT`
- **Cause**: network timeout, HTTP 429/502/503/504.
- **Action**: retry the single operation with bounded exponential backoff (see [retry-strategy.md](./retry-strategy.md)).
- **Impact**: briefly pauses the batch. If retries are exhausted, the item becomes a `VALIDATION`-style failed item — it does **not** escalate to `FATAL`.

## `FATAL`
- **Cause**: invalid credentials, missing API scopes, an unsupported entity type for the platform, target platform outage.
- **Action**: stop the current wave.
- **Impact**: the run is marked `FAILED`. Remaining waves do not run. `errorSummary` is populated.

## Failed items

Instead of a separate dead-letter-queue collection, failures are embedded on the run:

```
MigrationRun.failedItems[] = { entityType, sourceId, reason, errorType, occurredAt }
```

The run detail page renders this list. Re-running the project (optionally with
`resumeFromRunId`) re-attempts everything; there is no per-item replay endpoint.
