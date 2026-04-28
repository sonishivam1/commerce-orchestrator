---
name: etl-pipeline
description: Core ETL engine design and implementation skill for Commerce Data Orchestrator. Encodes the EtlEngine contract, EtlContext lifecycle, batch processing with circuit breaker, event-driven progress reporting, and retry semantics. Invoke when building or modifying any pipeline execution logic.
user-invocable: true
---

# ETL Pipeline Skill — Commerce Data Orchestrator

## Pipeline Architecture Overview

```
Job Request (API)
    ↓
[BullMQ Queue]        ← QUEUE_ETL or QUEUE_SCRAPE
    ↓
[Worker Processor]    ← Decrypts credentials, acquires Redlock
    ↓
[Orchestrator]        ← Builds EtlContext, wires Source + Target
    ↓
[EtlEngine]           ← Pure TS — no framework deps
    ↓  ↓  ↓
[Source.extract()]  →  [batch]  →  [Target.load()]
    ↓
[Events: progress | failure | complete]
    ↓
[Worker]              ← Updates job status, releases Redlock
```

---

## EtlContext — The Pipeline's Identity

Every pipeline execution carries an `EtlContext` — it is the single source of truth for the running job.

```typescript
export interface EtlContext {
    tenantId: string;                         // From JWT — scopes all operations
    jobId: string;                            // MongoDB Job document ID
    correlationId: string;                    // Trace ID for structured logging
    lockToken?: string;                       // Redlock token for release
    sourceCredentials: Record<string, unknown>; // Decrypted in worker memory ONLY
    targetCredentials: Record<string, unknown>; // Decrypted in worker memory ONLY
}
```

**Rules:**
- `tenantId` is extracted from the JWT claim and NEVER from user input.
- Credentials are AES-256-GCM encrypted at rest in MongoDB. The worker decrypts them into `EtlContext` in memory, and they are garbage-collected after the pipeline run.
- `correlationId` is attached to every log line for end-to-end tracing.

---

## EtlEngine — The Core Loop

```typescript
import { CanonicalEntity, DEFAULT_BATCH_SIZE, MAX_JOB_RETRIES } from '@cdo/shared';
import type { SourceConnector, TargetConnector } from '../interfaces';

export class EtlEngine<T extends CanonicalEntity = CanonicalEntity> {
    constructor(
        private readonly source: SourceConnector<T>,
        private readonly target: TargetConnector<T>,
        private readonly context: EtlContext,
        options: EtlEngineOptions = {},
    ) {}

    // Event-driven API
    on(event: 'progress', handler: (results: LoadResult[]) => void): this;
    on(event: 'failure', handler: (error: Error, item?: T) => void): this;
    on(event: 'complete', handler: () => void): this;

    async run(): Promise<void> {
        await this.source.initialize(this.context.sourceCredentials);
        await this.target.initialize(this.context.targetCredentials);

        for await (const sourceBatch of this.source.extract()) {
            // Batch into DEFAULT_BATCH_SIZE chunks
            await this.processBatch(currentBatch);
        }

        this.completeHandler?.();
    }
}
```

---

## Batch Processing Strategy

```
Batch (50 items)
    ↓
[Target.load(batch)]
    ↓ success?
    YES → emit 'progress' with LoadResult[]
    NO  → check error type:
        ├── FatalError    → trip circuit breaker, halt pipeline
        ├── TransientError → retry with exponential backoff (max 3)
        └── ValidationError → fallback to item-by-item processing
                ↓
            [Target.load([item])]  ← isolate the bad item
                ↓
            Report individual failures via 'failure' event
```

**Key Constants (from `@cdo/shared/constants`):**
- `DEFAULT_BATCH_SIZE = 50`
- `MAX_JOB_RETRIES = 3`
- `RETRY_BACKOFF_DELAY_MS = 5_000` (exponential)
- `CIRCUIT_BREAKER_THRESHOLD = 10` (consecutive non-validation failures)

---

## Circuit Breaker Pattern

```typescript
export class CircuitBreaker {
    private failures = 0;
    private readonly threshold = CIRCUIT_BREAKER_THRESHOLD; // 10

    check(): void {
        if (this.failures >= this.threshold) {
            throw new Error('Circuit breaker tripped — too many consecutive failures');
        }
    }

    recordSuccess(): void { this.failures = 0; }

    recordFailure(type?: ErrorType): void {
        // Validation errors don't count — they're data quality issues, not infra problems
        if (type === ErrorType.VALIDATION) return;
        this.failures++;
    }

    trip(): void { this.failures = this.threshold; }
}
```

---

## Error Taxonomy

| Error Type | Meaning | Pipeline Behavior |
|---|---|---|
| `ValidationError` | Bad data from source | Skip item, push to DLQ, continue |
| `TransientError` | Network timeout, rate limit | Retry with backoff, then DLQ |
| `FatalError` | Auth failure, schema mismatch | Trip circuit breaker, halt pipeline |

```typescript
import { ErrorType } from '@cdo/shared';

// Classify errors correctly — this determines pipeline behavior
if (error.message.includes('rate limit')) {
    (error as any).type = ErrorType.TRANSIENT;
} else if (error.message.includes('validation')) {
    (error as any).type = ErrorType.VALIDATION;
} else {
    (error as any).type = ErrorType.FATAL;
}
```

---

## Orchestrator Pattern (Worker → Engine)

The worker NEVER directly instantiates connectors. The Orchestrator does:

```typescript
export class EtlOrchestrator {
    async execute(job: JobDocument, credentials: DecryptedCredentials): Promise<void> {
        const source = ConnectorFactory.createSource(job.sourcePlatform);
        const target = ConnectorFactory.createTarget(job.targetPlatform);

        const context: EtlContext = {
            tenantId: job.tenantId,
            jobId: job._id.toString(),
            correlationId: generateCorrelationId(),
            sourceCredentials: credentials.source,
            targetCredentials: credentials.target,
        };

        const engine = new EtlEngine(source, target, context);

        engine.on('progress', (results) => {
            // Update job progress in MongoDB
        });
        engine.on('failure', (error, item) => {
            // Push to DLQ repository
        });
        engine.on('complete', () => {
            // Mark job as COMPLETED
        });

        await engine.run();
    }
}
```

---

## Checklist When Modifying the Pipeline

- [ ] `EtlContext` carries `tenantId` — never hardcoded
- [ ] Credentials decrypted in worker, passed through context — never stored
- [ ] Error type correctly classified (`ValidationError`, `TransientError`, `FatalError`)
- [ ] Circuit breaker resets on success (`recordSuccess()`)
- [ ] Batch fallback to item-by-item on non-fatal batch failure
- [ ] `correlationId` present in all log lines
- [ ] Redlock acquired before `engine.run()`, released in `finally` block
- [ ] LoadResult checked for per-item success/failure
