import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobRepository, DlqRepository, CredentialRepository } from '@cdo/db';
import { JobProducer } from '@cdo/queue';
import { CreateJobInput } from './dto/create-job.input';
import { JobKind } from './dto/job.type';

@Injectable()
export class JobService {
    constructor(
        private readonly jobRepository:        JobRepository,
        private readonly dlqRepository:        DlqRepository,
        private readonly jobProducer:          JobProducer,
        private readonly credentialRepository: CredentialRepository,
    ) {}

    // ── Credential guard ────────────────────────────────────────────────────

    /**
     * Throws ForbiddenException (never NotFoundException) when the credential
     * is missing or belongs to a different tenant. Using ForbiddenException
     * rather than NotFoundException is deliberate — it avoids leaking whether
     * a given credential ID exists in the system at all.
     */
    private async assertCredentialOwnership(
        tenantId:     string,
        credentialId: string,
        role:         'source' | 'target',
    ): Promise<void> {
        const cred = await this.credentialRepository.findOneForTenant(tenantId, credentialId);
        if (!cred) {
            throw new ForbiddenException(
                `${role} credential does not exist or does not belong to this tenant`,
            );
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    async findAll(tenantId: string) {
        return this.jobRepository.findAllForTenant(tenantId);
    }

    async findOne(tenantId: string, id: string) {
        const job = await this.jobRepository.findOneForTenant(tenantId, id);
        if (!job) throw new NotFoundException(`Job ${id} not found`);
        return job;
    }

    async create(tenantId: string, input: CreateJobInput) {
        const isScrapeJob = input.kind === JobKind.SCRAPE_IMPORT;

        // ── Input validation ────────────────────────────────────────────────
        if (isScrapeJob && !input.sourceUrl) {
            throw new BadRequestException('sourceUrl is required for SCRAPE_IMPORT jobs');
        }
        if (!isScrapeJob && !input.sourceCredentialId) {
            throw new BadRequestException('sourceCredentialId is required for ETL jobs');
        }
        const isExport = input.kind === JobKind.EXPORT;
        if (!isScrapeJob && !isExport && !input.targetCredentialId) {
            throw new BadRequestException('targetCredentialId is required for migration/clone jobs');
        }

        // ── Credential ownership check (BEFORE any DB writes) ───────────────
        // Verifying ownership before creating the Job document means a tenant
        // can never anchor a job to credentials it doesn't own, even transiently.
        if (input.sourceCredentialId) {
            await this.assertCredentialOwnership(tenantId, input.sourceCredentialId, 'source');
        }
        if (input.targetCredentialId) {
            await this.assertCredentialOwnership(tenantId, input.targetCredentialId, 'target');
        }

        // ── Create job ──────────────────────────────────────────────────────
        const correlationId = randomUUID();
        const traceId       = randomUUID();

        const jobDoc = await this.jobRepository.create({
            tenantId,
            kind:               input.kind,
            status:             'PENDING',
            traceId,
            correlationId,
            sourceCredentialId: input.sourceCredentialId,
            targetCredentialId: input.targetCredentialId ?? undefined,
            sourceUrl:          input.sourceUrl ?? undefined,
        });

        const jobId = String(jobDoc._id);

        if (isScrapeJob) {
            await this.jobProducer.enqueueScrapeJob({
                jobId,
                tenantId,
                correlationId,
                traceId,
                kind:              'SCRAPE_IMPORT',
                sourceUrl:         input.sourceUrl!,
                targetCredentialId: input.targetCredentialId!,
            });
        } else {
            await this.jobProducer.enqueueEtlJob({
                jobId,
                tenantId,
                correlationId,
                traceId,
                kind:              input.kind as 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT',
                sourceCredentialId: input.sourceCredentialId!,
                targetCredentialId: input.targetCredentialId!,
            });
        }

        return jobDoc;
    }

    async deleteJob(tenantId: string, id: string): Promise<boolean> {
        const job = await this.jobRepository.findOneForTenant(tenantId, id);
        if (!job) throw new NotFoundException(`Job ${id} not found`);
        if (job.status === 'RUNNING') {
            throw new BadRequestException(
                'Cannot delete a RUNNING job. Wait for it to complete or fail.',
            );
        }
        return this.jobRepository.delete(tenantId, id);
    }

    async replayDlqItem(tenantId: string, jobId: string, dlqItemId: string) {
        const dlqItem = await this.dlqRepository.findOneForTenant(tenantId, dlqItemId);

        if (!dlqItem) throw new NotFoundException(`DLQ item ${dlqItemId} not found`);
        if (dlqItem.replayed) throw new BadRequestException(`DLQ item ${dlqItemId} already replayed`);
        if (!dlqItem.canReplay) {
            throw new BadRequestException(
                `DLQ item ${dlqItemId} is not replayable (ValidationError requires manual intervention)`,
            );
        }

        const parentJob = await this.jobRepository.findOneForTenant(tenantId, jobId);
        if (!parentJob) throw new NotFoundException(`Parent job ${jobId} not found`);

        // ── Re-validate credential ownership at replay time (defense-in-depth) ─
        // Credentials can be deleted or re-assigned after a job was created.
        // Re-checking prevents a tenant from replaying a job whose credentials
        // are no longer accessible to it.
        if (parentJob.sourceCredentialId) {
            await this.assertCredentialOwnership(tenantId, parentJob.sourceCredentialId, 'source');
        }
        if (parentJob.targetCredentialId) {
            await this.assertCredentialOwnership(tenantId, parentJob.targetCredentialId, 'target');
        }

        if (parentJob.kind === 'SCRAPE_IMPORT') {
            if (!parentJob.sourceUrl) {
                throw new BadRequestException(
                    `Cannot replay: parent job ${jobId} has no sourceUrl`,
                );
            }
            await this.jobProducer.enqueueScrapeJob({
                jobId:              dlqItem.jobId,
                tenantId,
                correlationId:      randomUUID(),
                traceId:            randomUUID(),
                kind:               'SCRAPE_IMPORT',
                sourceUrl:          parentJob.sourceUrl,
                targetCredentialId: parentJob.targetCredentialId!,
            });
        } else {
            await this.jobProducer.enqueueEtlJob({
                jobId:              dlqItem.jobId,
                tenantId,
                correlationId:      randomUUID(),
                traceId:            randomUUID(),
                kind:               parentJob.kind as 'CROSS_PLATFORM_MIGRATION' | 'PLATFORM_CLONE' | 'EXPORT',
                sourceCredentialId: parentJob.sourceCredentialId!,
                targetCredentialId: parentJob.targetCredentialId!,
            });
        }

        await this.dlqRepository.markReplayed(dlqItemId);
        return parentJob;
    }

    async findDlqItems(tenantId: string, jobId: string) {
        return this.dlqRepository.findAllForJob(tenantId, jobId);
    }
}
