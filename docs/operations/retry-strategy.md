# Retry Strategy

## Item-level retries (exponential backoff)

When a connector raises a `TRANSIENT` error (HTTP 429, 502/503/504, timeout), the engine retries that single operation.

- **Initial delay**: 500ms
- **Multiplier**: 2×
- **Max retries**: 5
- **Max delay**: 10000ms

If the operation still fails after the last retry, the item is recorded as a
failed item on the run (`MigrationRun.failedItems[]`) and the wave continues. It
does not escalate to `FATAL` — only genuinely fatal conditions (bad credentials,
unsupported entity, sustained platform outage surfaced as such) do that.

There is **no circuit breaker**. If a platform is down, `FATAL` errors from
`initialize()` or the first batch stop the wave quickly enough on their own.

## Batch-level fallback

Batch size is 50. If a whole-batch write fails, the engine retries the batch
item-by-item so one poison record does not lose the other 49.

## Infrastructure resiliency

- **BullMQ**: a job whose worker dies mid-run is re-delivered per BullMQ's stalled-job config. The job id equals the run id, so re-delivery resumes the same run rather than creating a duplicate.
- **Concurrency**: `createMigrationRun` rejects a new run while the project has one in `RUNNING`. With a single worker this is enough; no distributed lock.
