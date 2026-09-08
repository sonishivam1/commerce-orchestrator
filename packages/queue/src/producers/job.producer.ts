/**
 * @file job.producer.ts
 * @package @cdo/queue
 *
 * BullMQ producer — enqueues migration/export run jobs onto the ETL queue.
 *
 * Injected by apps/api when a client starts a run via GraphQL.
 * Queue name and retry policy come from @cdo/shared constants — never hardcoded here.
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    QUEUE_ETL,
    MAX_JOB_RETRIES,
    RETRY_BACKOFF_DELAY_MS,
    COMPLETED_JOB_RETENTION_COUNT,
} from '@cdo/shared';

/** Payload shape for a migration/export run job. */
export interface EtlJobPayload {
    /** Equals the MigrationRun id — also used as the BullMQ job id for idempotent enqueue. */
    jobId: string;
    tenantId: string;
    /** Single request id, propagated to worker log lines. */
    correlationId: string;
    traceId: string;
    kind: 'MIGRATION_RUN';
    sourceCredentialId: string;
    targetCredentialId: string;
    entityTypes?: string[];
    /** The MigrationRun document id the worker drives to completion. */
    migrationRunId?: string;
    /** When true the wave executor skips target.load() calls. */
    dryRun?: boolean;
}

@Injectable()
export class JobProducer {
    constructor(
        @InjectQueue(QUEUE_ETL) private readonly etlQueue: Queue,
    ) { }

    getEtlQueue(): Queue {
        return this.etlQueue;
    }

    /**
     * Enqueues a migration/export run job.
     * Uses jobId as the BullMQ job ID to make enqueue idempotent —
     * duplicate enqueues for the same jobId are deduplicated by BullMQ.
     */
    async enqueueEtlJob(payload: EtlJobPayload): Promise<void> {
        await this.etlQueue.add(payload.kind, payload, {
            jobId: payload.jobId,
            attempts: MAX_JOB_RETRIES,
            backoff: { type: 'exponential', delay: RETRY_BACKOFF_DELAY_MS },
            removeOnComplete: { count: COMPLETED_JOB_RETENTION_COUNT },
            removeOnFail: false, // Keep failed jobs for investigation
        });
    }
}
