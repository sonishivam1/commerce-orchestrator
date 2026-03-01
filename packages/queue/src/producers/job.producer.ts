import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface EtlJobPayload {
    jobId: string;
    tenantId: string;
    correlationId: string;
    kind: 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT';
    sourceCredentialId: string;
    targetCredentialId?: string;
}

export interface ScrapeJobPayload {
    jobId: string;
    tenantId: string;
    correlationId: string;
    kind: 'SCRAPE_IMPORT';
    sourceUrl: string;
    targetCredentialId: string;
}

@Injectable()
export class JobProducer {
    constructor(
        @InjectQueue('etl-queue') private readonly etlQueue: Queue,
        @InjectQueue('scrape-queue') private readonly scrapeQueue: Queue,
    ) { }

    async enqueueEtlJob(payload: EtlJobPayload): Promise<void> {
        await this.etlQueue.add(payload.kind, payload, {
            jobId: payload.jobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
            removeOnFail: false,
        });
    }

    async enqueueScrapeJob(payload: ScrapeJobPayload): Promise<void> {
        await this.scrapeQueue.add('SCRAPE_IMPORT', payload, {
            jobId: payload.jobId,
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: { count: 100 },
            removeOnFail: false,
        });
    }
}
