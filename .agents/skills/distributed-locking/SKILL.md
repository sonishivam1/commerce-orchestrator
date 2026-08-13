---
name: distributed-locking
description: Distributed locking skill for Commerce Data Orchestrator using Redis Redlock. Encodes lock key format, TTL management, acquire/release lifecycle, and guard patterns for preventing concurrent writes to the same target environment. Invoke when implementing or reviewing locking logic.
user-invocable: true
---

# Distributed Locking Skill — Commerce Data Orchestrator

## Why Distributed Locking?

Multiple workers can process jobs concurrently. Without locking, two jobs targeting the same Shopify store could:
- Create duplicate products (both upsert the same item simultaneously)
- Corrupt variant data (interleaved writes)
- Hit rate limits (double the API calls)

**Redlock ensures only ONE pipeline writes to a given target environment at a time.**

---

## Lock Key Format

```
lock:{tenantId}:{targetCredentialId}
```

Examples:
- `lock:tenant_abc:cred_shopify_prod` — locks Shopify production for tenant ABC
- `lock:tenant_xyz:cred_ct_staging` — locks commercetools staging for tenant XYZ

The key combines tenant isolation with credential specificity — different tenants can write to different stores simultaneously, but the same tenant cannot run two jobs against the same target.

---

## Lock Service Implementation

```typescript
// apps/worker-etl/src/services/lock.service.ts
import Redlock from 'redlock';
import Redis from 'ioredis';
import { LOCK_TTL_MS, LOCK_KEY_PREFIX } from '@cdo/shared';

@Injectable()
export class LockService {
    private redlock: Redlock;

    constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
        this.redlock = new Redlock([this.redis], {
            retryCount: 3,
            retryDelay: 200,      // ms between retries
            retryJitter: 100,     // random jitter to prevent thundering herd
        });
    }

    /**
     * Acquire a distributed lock for a target environment.
     * @returns Lock object (contains token for release)
     * @throws Error if lock cannot be acquired (another job is writing)
     */
    async acquire(tenantId: string, targetCredentialId: string): Promise<Redlock.Lock> {
        const key = `${LOCK_KEY_PREFIX}:${tenantId}:${targetCredentialId}`;
        return this.redlock.acquire([key], LOCK_TTL_MS); // 30 minutes
    }

    /**
     * Release a lock. MUST be called in a finally block.
     */
    async release(lock: Redlock.Lock): Promise<void> {
        try {
            await lock.release();
        } catch (error) {
            // Lock may have already expired — log but don't throw
            this.logger.warn('Failed to release lock (may have expired)', {
                error: error.message,
            });
        }
    }

    /**
     * Extend a lock's TTL (for long-running pipelines).
     */
    async extend(lock: Redlock.Lock, additionalMs: number): Promise<Redlock.Lock> {
        return lock.extend(additionalMs);
    }
}
```

---

## Worker Integration Pattern

```typescript
// apps/worker-etl/src/processors/etl.processor.ts
@Processor(QUEUE_ETL)
export class EtlProcessor {
    constructor(
        private readonly lockService: LockService,
        private readonly orchestrator: EtlOrchestrator,
        private readonly credentialService: CredentialDecryptorService,
        private readonly jobRepository: JobRepository,
    ) {}

    @Process()
    async process(bullJob: Job<EtlJobPayload>): Promise<void> {
        const { tenantId, jobId, targetCredentialId } = bullJob.data;
        let lock: Redlock.Lock | undefined;

        try {
            // 1. Acquire lock BEFORE any target operations
            lock = await this.lockService.acquire(tenantId, targetCredentialId);

            // 2. Decrypt credentials
            const credentials = await this.credentialService.decrypt(
                tenantId,
                bullJob.data.sourceCredentialId,
                bullJob.data.targetCredentialId,
            );

            // 3. Update job status
            await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.RUNNING);

            // 4. Execute pipeline
            await this.orchestrator.execute(bullJob.data, credentials, lock);

            // 5. Mark complete
            await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.COMPLETED);

        } catch (error) {
            await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.FAILED);
            throw error; // BullMQ handles retry based on job config

        } finally {
            // 6. ALWAYS release lock — even on failure
            if (lock) await this.lockService.release(lock);
        }
    }
}
```

---

## Lock Extension for Long Pipelines

```typescript
// For pipelines that may exceed the 30-minute TTL:
engine.on('progress', async () => {
    if (lock) {
        lock = await this.lockService.extend(lock, LOCK_TTL_MS);
    }
});
```

---

## Constants

```typescript
// packages/shared/src/constants.ts
export const LOCK_TTL_MS = 30 * 60 * 1_000;     // 30 minutes
export const LOCK_KEY_PREFIX = 'lock';            // Redis key prefix
```

---

## Failure Scenarios

| Scenario | Behavior |
|---|---|
| Lock already held | `Redlock.LockError` thrown → BullMQ retries after backoff |
| Worker crashes mid-pipeline | Lock auto-expires after TTL (30 min) |
| Pipeline exceeds TTL | Must extend lock via `lock.extend()` |
| Redis goes down | `Redlock.LockError` → job fails, retried by BullMQ |

---

## Checklist

- [ ] Lock acquired BEFORE `orchestrator.execute()`
- [ ] Lock released in `finally` block — ALWAYS
- [ ] Lock key includes both `tenantId` AND `targetCredentialId`
- [ ] Long pipelines extend the lock in the `progress` event handler
- [ ] Lock service uses Redlock (not simple `SETNX`) for correctness
- [ ] Lock failure is handled gracefully — job retried, not crashed
- [ ] `LOCK_TTL_MS` imported from `@cdo/shared/constants`, not hardcoded
