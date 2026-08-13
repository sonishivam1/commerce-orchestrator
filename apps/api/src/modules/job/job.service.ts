import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobRepository, CredentialRepository } from '@cdo/db';
import { JobProducer } from '@cdo/queue';
import { QUEUE_ETL } from '@cdo/shared';
import { CreateJobInput } from './dto/create-job.input';
import { JobKind } from './dto/job.type';

@Injectable()
export class JobService {
    constructor(
        private readonly jobRepository: JobRepository,
        private readonly credentialRepository: CredentialRepository,
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

        // Validate credential ownership — both must belong to this tenant
        const [sourceCred, targetCred] = await Promise.all([
            input.sourceCredentialId
                ? this.credentialRepository.findOneForTenant(tenantId, input.sourceCredentialId)
                : Promise.resolve(null),
            input.targetCredentialId
                ? this.credentialRepository.findOneForTenant(tenantId, input.targetCredentialId)
                : Promise.resolve(null),
        ]);

        if (input.sourceCredentialId && !sourceCred) {
            throw new BadRequestException(
                `Source credential ${input.sourceCredentialId} not found for this tenant`
            );
        }

        if (input.targetCredentialId && !targetCred) {
            throw new BadRequestException(
                `Target credential ${input.targetCredentialId} not found for this tenant`
            );
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

}
