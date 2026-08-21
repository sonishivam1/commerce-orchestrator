# Error Taxonomy

Errors during the ETL pipeline are categorized into three explicit types to determine how the worker should handle them.

## 1. ValidationError
- **Cause**: Bad data, missing required fields, or failure to pass Zod schema validation.
- **Action**: The item is skipped and pushed to the Dead Letter Queue (DLQ).
- **Impact**: The batch continues processing. The job remains healthy.

## 2. TransientError
- **Cause**: Network timeouts, HTTP 502/503/504, or rate limiting (HTTP 429).
- **Action**: The specific request is retried using exponential backoff.
- **Impact**: Pauses the batch temporarily. If retries are exhausted, it elevates to a `FatalError`.

## 3. FatalError
- **Cause**: Invalid credentials, missing API permissions, target platform outage, or an unhandled exception.
- **Action**: Trips the Circuit Breaker.
- **Impact**: Halts the entire pipeline and marks the Job as `FAILED`. No further items are processed for this job.

## Dead Letter Queue (DLQ)
Items that fail with a `ValidationError` (or exhausted `TransientError`s on an item-by-item basis) are recorded in the DLQ repository. The DLQ stores:
- `tenantId`, `jobId`, `itemKey`
- The `errorType` and raw payload
- A boolean flag `canReplay` (Validation errors are generally false until data is manually fixed).
