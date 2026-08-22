# Sub-Plan: Phase 3 — Redlock + Worker Fixes

> **Status:** AWAITING APPROVAL  
> **Priority:** 🔴 Critical — Data safety + correctness  
> **Depends on:** Phase 0 (done), Phase 1 partial (engine + connectors exist)  
> **Blocks:** Any real end-to-end pipeline run in production  
> **Skill references:** `.claude/skills/distributed-locking/SKILL.md`, `.claude/skills/etl-pipeline/SKILL.md`, `.claude/skills/bullmq-jobs/SKILL.md`  
> **Agent:** `pipeline-architect`

---

## Problem Statement

Three critical gaps make the current worker planes unsafe and incorrect:

1. **Duplicate scrape consumer** — `apps/worker-etl` registers a stub `ScrapeProcessor` on `QUEUE_SCRAPE`. Since `apps/worker-scrape` also consumes that queue, jobs can be silently picked up by the stub and do nothing. This is a data loss bug.

2. **No distributed locking** — Both `etl.processor.ts` and `scrape.processor.ts` have `// TODO: Redis Redlock` comments. Without Redlock, two concurrent jobs can write to the same target store simultaneously, causing duplicate products, corrupted variants, and unnecessary API rate limit hits.

3. **No RUNNING status transition** — Jobs go from `PENDING` directly to `COMPLETED` or `FAILED`. The dashboard shows no in-progress state, making monitoring impossible.

---

## Acceptance Criteria

- [ ] `worker-etl` does NOT register any processor for `QUEUE_SCRAPE`
- [ ] `LockService` exists at `apps/worker-etl/src/services/lock.service.ts`
- [ ] `LockService` exists at `apps/worker-scrape/src/services/lock.service.ts`
- [ ] Lock is acquired before `orchestrator.execute()` in both processors
- [ ] Lock is always released in the `finally` block — even if the pipeline throws
- [ ] Job status transitions: `PENDING → RUNNING → COMPLETED | FAILED`
- [ ] `LockService` is injected via NestJS DI (not instantiated with `new`)
- [ ] `npx tsc --noEmit` = 0 errors after changes
- [ ] Unit test for `LockService` covers: acquire, release, extend, lock-already-held scenario

---

## Files to Change

### DELETE / MODIFY

| File | Action | Reason |
|------|--------|--------|
| `apps/worker-etl/src/processors/scrape/scrape.processor.ts` | **Delete** | Stub processor — conflicts with real `worker-scrape` |
| `apps/worker-etl/src/processors/scrape/scrape-processor.module.ts` | **Delete** | Module for the above stub |
| `apps/worker-etl/src/worker.module.ts` | **Modify** | Remove `ScrapeProcessorModule` import |

### CREATE

| File | Purpose |
|------|---------|
| `apps/worker-etl/src/services/lock.service.ts` | Redlock wrapper — acquire, release, extend |
| `apps/worker-etl/src/services/lock.module.ts` | NestJS module providing `LockService` + Redis client |
| `apps/worker-etl/src/__tests__/lock.service.spec.ts` | Unit tests for LockService |
| `apps/worker-scrape/src/services/lock.service.ts` | Same LockService for scrape worker |
| `apps/worker-scrape/src/services/lock.module.ts` | NestJS module for scrape worker |

### MODIFY

| File | Change |
|------|--------|
| `apps/worker-etl/src/processors/etl/etl.processor.ts` | Add: Redlock acquire/release, RUNNING transition |
| `apps/worker-etl/src/processors/etl/etl-processor.module.ts` | Import `LockModule`, inject `LockService` |
| `apps/worker-scrape/src/processors/scrape/scrape.processor.ts` | Add: Redlock acquire/release, RUNNING transition |
| `apps/worker-scrape/src/scrape-worker.module.ts` | Import `LockModule` |

---

## Implementation Detail

### 1. LockService

```typescript
// apps/worker-etl/src/services/lock.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import Redlock, { Lock } from 'redlock';
import type { Redis } from 'ioredis';
import { LOCK_TTL_MS, LOCK_KEY_PREFIX } from '@cdo/shared';

@Injectable()
export class LockService {
    private readonly logger = new Logger(LockService.name);
    private readonly redlock: Redlock;

    constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
        this.redlock = new Redlock([this.redis], {
            retryCount: 3,
            retryDelay: 200,
            retryJitter: 100,
            automaticExtensionThreshold: 500,
        });
    }

    async acquire(tenantId: string, targetCredentialId: string): Promise<Lock> {
        const key = `${LOCK_KEY_PREFIX}:${tenantId}:${targetCredentialId}`;
        this.logger.log(`Acquiring lock: ${key}`);
        return this.redlock.acquire([key], LOCK_TTL_MS);
    }

    async release(lock: Lock): Promise<void> {
        try {
            await lock.release();
        } catch (err) {
            // Lock may have expired — safe to ignore, log for observability
            this.logger.warn(`Lock release failed (may have expired): ${(err as Error).message}`);
        }
    }

    async extend(lock: Lock, additionalMs: number): Promise<Lock> {
        return lock.extend(additionalMs);
    }
}
```

### 2. LockModule

```typescript
// apps/worker-etl/src/services/lock.module.ts
import { Module } from '@nestjs/common';
import { LockService } from './lock.service';
import { createRedisConnection } from '@cdo/redis';

@Module({
    providers: [
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => createRedisConnection(),
        },
        LockService,
    ],
    exports: [LockService],
})
export class LockModule {}
```

### 3. ETL Processor — full updated flow

```typescript
// apps/worker-etl/src/processors/etl/etl.processor.ts (modified sections)

import { LockService } from '../../services/lock.service';
import { JobStatus } from '@cdo/shared';
import type { Lock } from 'redlock';

// In process():
async process(job: Job): Promise<void> {
    const { tenantId, jobId, kind, sourceCredentialId, targetCredentialId } = job.data;
    let lock: Lock | undefined;

    try {
        // 1. Transition to RUNNING immediately
        await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.RUNNING);

        // 2. Acquire Redlock before any target operations
        lock = await this.lockService.acquire(tenantId, targetCredentialId);

        // 3. Decrypt credentials (existing logic)
        // ...

        // 4. Hand off to orchestrator (existing logic)
        // ...

    } catch (error) {
        await this.jobRepository.markFailed(jobId, { message: (error as Error).message });
        throw error;
    } finally {
        // ALWAYS release — even on error
        if (lock) await this.lockService.release(lock);
    }
}
```

### 4. Lock extension during long pipelines

In `DataEtlOrchestrator`, extend the lock on every `progress` event:

```typescript
engine.on('progress', async (results) => {
    // ... existing progress logic ...
    
    // Extend lock so long pipelines don't expire mid-run
    if (config.lock) {
        config.lock = await this.lockService.extend(config.lock, LOCK_TTL_MS);
    }
});
```

> This requires passing `lock` + `lockService` into the orchestrator's `execute()` config. Update `JobStrategyConfig` accordingly.

---

## Shared Constants (verify these exist in `@cdo/shared`)

```typescript
// packages/shared/src/constants.ts — should already exist
export const LOCK_TTL_MS = 30 * 60 * 1_000;   // 30 minutes
export const LOCK_KEY_PREFIX = 'lock';
```

---

## Test Plan

### Unit: `lock.service.spec.ts`

| Test | Assertion |
|------|-----------|
| `acquire()` returns a Lock object | Lock has a `release()` method |
| `release()` calls `lock.release()` | No error thrown on success |
| `release()` swallows errors silently | No throw if lock expired |
| `extend()` returns an extended Lock | TTL is updated |
| Concurrent `acquire()` on same key | Second call throws `LockError` |

Mock strategy: Use `ioredis-mock` — do NOT hit real Redis in unit tests.

### Integration (manual, not automated)

1. Start both workers + Redis
2. Create two jobs for the same `targetCredentialId`
3. Confirm second job waits / retries — does NOT run concurrently

---

## Dependency Notes

- `redlock` must be installed in both `apps/worker-etl` and `apps/worker-scrape` ✅ (done)
- `ioredis` must be installed in both workers ✅ (done)
- `@cdo/redis` package provides `createRedisConnection()` — reuse it, don't duplicate
- `JobRepository.updateStatus(tenantId, jobId, status)` — verify this method exists in `@cdo/db`

---

## Risk & Rollback

| Risk | Mitigation |
|------|-----------|
| `redlock` v5 API differs from v4 | Use `redlock@latest` and verify `Lock.release()` API |
| Lock TTL too short for large catalogs | Extension in `progress` handler covers this |
| `REDIS_CLIENT` injection conflicts with BullMQ's Redis | Use a separate Redis connection instance for Redlock |

---

## Out of Scope for This Plan

- Credential decryptor extraction (separate sub-plan)
- PLATFORM_CLONE two-phase logic
- EXPORT topology
- Any frontend changes
