import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobRepository, DlqRepository } from '@cdo/db';
import { JobProducer } from '@cdo/queue';
import { QUEUE_ETL } from '@cdo/shared';
import { CreateJobInput } from './dto/create-job.input';
import { JobKind } from './dto/job.type';

@Injectable()
export class JobService {
    constructor(
        private readonly jobRepository: JobRepository,
        private readonly dlqRepository: DlqRepository,
        private readonly jobProducer: JobProducer,
    ) {}

    async findAll(tenantId: string) {
        return this.jobRepository.findAllForTenant(tenantId);
    }

    async findOne(tenantId: string, id: string) {
        const job = await this.jobRepository.findOneForTenant(tenantId, id);
        if (!job) {
            throw new NotFoundException(`Job ${id} not found`);
        }
        return job;
    }

    async create(tenantId: string, input: CreateJobInput) {
        const isScrapeJob = input.kind === JobKind.SCRAPE_IMPORT;

        if (isScrapeJob && !input.sourceUrl) {
            throw new BadRequestException('sourceUrl is required for SCRAPE_IMPORT jobs');
        }
        if (!isScrapeJob && !input.sourceCredentialId) {
            throw new BadRequestException('sourceCredentialId is required for ETL jobs');
        }
        if (!isScrapeJob && !input.targetCredentialId) {
            throw new BadRequestException('targetCredentialId is required for ETL jobs');
        }

        const correlationId = randomUUID();
        const traceId = randomUUID();

        // Persist job record first — so the worker can update it by ID
        const jobDoc = await this.jobRepository.create({
            tenantId,
            kind: input.kind,
            status: 'PENDING',
            traceId,
            correlationId,
            sourceCredentialId: input.sourceCredentialId,
            targetCredentialId: input.targetCredentialId ?? undefined,
            sourceUrl: input.sourceUrl ?? undefined,
        });

        const jobId = String(jobDoc._id);

        // Enqueue via the shared JobProducer — keeps queue logic inside @cdo/queue
        if (isScrapeJob) {
            await this.jobProducer.enqueueScrapeJob({
                jobId,
                tenantId,
                correlationId,
                traceId,
                kind: 'SCRAPE_IMPORT',
                sourceUrl: input.sourceUrl!,
                targetCredentialId: input.targetCredentialId!,
            });
        } else {
            await this.jobProducer.enqueueEtlJob({
                jobId,
                tenantId,
                correlationId,
                traceId,
                kind: input.kind as 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT',
                sourceCredentialId: input.sourceCredentialId!,
                targetCredentialId: input.targetCredentialId!,
            });
        }

        return jobDoc;
    }

    async replayDlqItem(tenantId: string, jobId: string, dlqItemId: string) {
        const dlqItem = await this.dlqRepository.findOneForTenant(tenantId, dlqItemId);

        if (!dlqItem) {
            throw new NotFoundException(`DLQ item ${dlqItemId} not found`);
        }
        if (dlqItem.replayed) {
            throw new BadRequestException(`DLQ item ${dlqItemId} has already been replayed`);
        }
        if (!dlqItem.canReplay) {
            throw new BadRequestException(`DLQ item ${dlqItemId} is not replayable (Validation error requires manual intervention)`);
        }

        const parentJob = await this.jobRepository.findOneForTenant(tenantId, jobId);
        if (!parentJob) {
            throw new NotFoundException(`Parent job ${jobId} not found`);
        }

        // Re-enqueue original job to ETL queue for retry of this single item
        // The replay payload mirrors the original job but marks this as a replay
        await this.jobProducer.enqueueEtlJob({
            jobId: dlqItem.jobId,
            tenantId,
            correlationId: randomUUID(),
            traceId: randomUUID(),
            kind: parentJob.kind as 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT',
            sourceCredentialId: parentJob.sourceCredentialId!,
            targetCredentialId: parentJob.targetCredentialId!,
        });

        await this.dlqRepository.markReplayed(dlqItemId);

        return parentJob;
    }

    async findDlqItems(tenantId: string, jobId: string) {
        return this.dlqRepository.findAllForJob(tenantId, jobId);
    }
}
