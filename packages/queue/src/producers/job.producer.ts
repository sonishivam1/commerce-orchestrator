/**
 * @file job.producer.ts
 * @package @cdo/queue
 *
 * BullMQ producer — enqueues ETL and Scrape jobs onto their respective queues.
 *
 * This producer is injected by apps/api when a client creates a job via GraphQL.
 * Queue names and retry policies come from @cdo/shared constants — never hardcoded here.
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    QUEUE_ETL,
    QUEUE_SCRAPE,
    MAX_JOB_RETRIES,
    MAX_SCRAPE_RETRIES,
    RETRY_BACKOFF_DELAY_MS,
    SCRAPE_RETRY_BACKOFF_DELAY_MS,
    COMPLETED_JOB_RETENTION_COUNT,
} from '@cdo/shared';

/** Payload shape for API-based ETL jobs */
export interface EtlJobPayload {
    jobId: string;
    tenantId: string;
    correlationId: string;
    traceId: string;
    kind: 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT';
    sourceCredentialId: string;
    targetCredentialId: string;
}

/** Payload shape for Playwright-based scrape import jobs */
export interface ScrapeJobPayload {
    jobId: string;
    tenantId: string;
    correlationId: string;
    traceId: string;
    kind: 'SCRAPE_IMPORT';
    sourceUrl: string;
    targetCredentialId: string;
}

@Injectable()
export class JobProducer {
    constructor(
        @InjectQueue(QUEUE_ETL) private readonly etlQueue: Queue,
        @InjectQueue(QUEUE_SCRAPE) private readonly scrapeQueue: Queue,
    ) { }

    /**
     * Enqueues an API-based ETL job (migration, clone, export).
     * Uses jobId as the BullMQ job ID to make enqueue idempotent —
     * duplicate enqueues for the same jobId are deduplicated by BullMQ.
     *
     * @param payload - Job parameters including tenant, credentials, and kind
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

    /**
     * Enqueues a Playwright-based scrape import job.
     * Fewer retries than ETL (browser startup is expensive).
     *
     * @param payload - Job parameters including source URL and target credential
     */
    async enqueueScrapeJob(payload: ScrapeJobPayload): Promise<void> {
        await this.scrapeQueue.add(payload.kind, payload, {
            jobId: payload.jobId,
            attempts: MAX_SCRAPE_RETRIES,
            backoff: { type: 'exponential', delay: SCRAPE_RETRY_BACKOFF_DELAY_MS },
            removeOnComplete: { count: COMPLETED_JOB_RETENTION_COUNT },
            removeOnFail: false,
        });
    }
}
