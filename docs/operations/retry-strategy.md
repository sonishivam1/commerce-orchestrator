# Retry Strategy

To ensure reliability during migrations, the system implements resilience mechanisms at both the item and batch levels.

## Item-Level Retries (Exponential Backoff)
When a Target or Source Connector encounters a `TransientError` (e.g., HTTP 429 Rate Limit, HTTP 502 Bad Gateway), the engine will automatically retry the specific operation.

- **Initial Delay**: 500ms
- **Multiplier**: 2x
- **Max Retries**: 5
- **Max Delay**: 10000ms

If an item exceeds the maximum retries, it is flagged as a `ValidationError` (for DLQ storage) or a `FatalError` if it signifies a broader outage.

## Circuit Breaker (Batch-Level)
To prevent the ETL pipeline from aggressively hammering a downed platform and filling up logs, a circuit breaker is implemented on the batch processor.

- **Threshold**: 10 consecutive non-validation failures.
- **Action**: The circuit breaker trips, instantly failing the entire Job with a `FatalError`.

## Infrastructure Resiliency
- **Queue (BullMQ)**: Jobs that crash mid-execution (e.g., worker node dies) will be picked up again by another worker according to BullMQ's active/stalled job configuration.
- **Locking**: (If implemented) Ensures that multiple workers do not attempt to process the exact same job ID simultaneously.
