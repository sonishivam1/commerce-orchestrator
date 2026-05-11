---
name: bullmq-jobs
description: BullMQ job queue skill for Commerce Data Orchestrator. Queue naming, producer/consumer patterns, retry policies, DLQ integration.
user-invocable: true
---

# BullMQ Jobs Skill — Commerce Data Orchestrator

## Queue Architecture

```
[API] → JobProducer → [QUEUE_ETL / QUEUE_SCRAPE] → Worker Processor
```

Queue names from `@cdo/shared/constants`:
- `QUEUE_ETL = 'etl-queue'` — API-based ETL jobs
- `QUEUE_SCRAPE = 'scrape-queue'` — Playwright scrape jobs

## Job Payloads

```typescript
interface EtlJobPayload {
    tenantId: string;
    jobId: string;
    kind: JobKind;
    sourcePlatform: string;
    targetPlatform: string;
    sourceCredentialId: string;
    targetCredentialId: string;
}
```

## Producer Pattern

```typescript
@Injectable()
export class JobProducer {
    async enqueueEtlJob(payload: EtlJobPayload): Promise<string> {
        const job = await this.etlQueue.add('etl', payload, {
            attempts: MAX_JOB_RETRIES,        // 3
            backoff: { type: 'exponential', delay: RETRY_BACKOFF_DELAY_MS },
            removeOnComplete: { count: 100 },
            removeOnFail: false,
        });
        return job.id!;
    }
}
```

## Processor Pattern

```typescript
@Processor(QUEUE_ETL)
export class EtlProcessor {
    async process(job: Job<EtlJobPayload>): Promise<void> {
        let lock;
        try {
            lock = await this.lockService.acquire(tenantId, targetCredentialId);
            const creds = await this.credentialService.decrypt(/*...*/);
            await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.RUNNING);
            await this.orchestrator.execute(job.data, creds, lock);
            await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.COMPLETED);
        } catch (error) {
            if (isFatal(error)) throw new UnrecoverableError(error.message);
            throw error; // BullMQ retries transient errors
        } finally {
            if (lock) await this.lockService.release(lock);
        }
    }
}
```

## Retry Constants

| Constant | Value | Purpose |
|---|---|---|
| `MAX_JOB_RETRIES` | 3 | ETL retry limit |
| `MAX_SCRAPE_RETRIES` | 2 | Scrape retry limit |
| `RETRY_BACKOFF_DELAY_MS` | 5000ms | ETL backoff |
| `SCRAPE_RETRY_BACKOFF_DELAY_MS` | 10000ms | Scrape backoff |

## Checklist

- [ ] Queue names from `@cdo/shared/constants`
- [ ] Fatal errors use `UnrecoverableError` to skip retries
- [ ] Lock acquired before processing, released in `finally`
- [ ] Failed items pushed to DLQ with entity snapshot
- [ ] Job status updated at each lifecycle stage
