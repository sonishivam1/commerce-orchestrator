import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { EtlContext } from '@cdo/core';
import { QUEUE_ETL } from '@cdo/shared';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Processor(QUEUE_ETL)
export class EtlProcessor extends WorkerHost {
    private readonly logger = new Logger(EtlProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: DataEtlOrchestrator,
        private readonly decryptor: CredentialDecryptor,
        private readonly lockService: LockService,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { tenantId, jobId, kind, sourceCredentialId, targetCredentialId, entityTypes } = job.data;

        this.logger.log(`[${jobId}] ETL job picked up — kind=${kind} tenant=${tenantId} entityTypes=${entityTypes?.join(',') ?? 'PRODUCTS'}`);

        // Mark RUNNING immediately so the UI reflects live status
        await this.jobRepository.markRunning(jobId);

        let lock = null;

        try {
            // Step 1: Fetch encrypted credentials from DB
            const sourceDoc = await this.credentialRepository.findOneDecrypted(tenantId, sourceCredentialId);
            if (!sourceDoc) {
                throw new Error(`Missing source credential — sourceCredentialId=${sourceCredentialId}`);
            }

            // EXPORT jobs write to disk — no target credential needed
            let targetDoc = null;
            if (kind !== 'EXPORT' && targetCredentialId) {
                targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);
                if (!targetDoc) {
                    throw new Error(`Missing target credential — targetCredentialId=${targetCredentialId}`);
                }
            }

            // Step 2: Decrypt credentials in worker memory only
            const sourceCredentials = this.decryptor.decrypt(
                sourceDoc.encryptedPayload,
                sourceDoc.iv,
                sourceDoc.authTag,
            );

            const targetCredentials: Record<string, unknown> = targetDoc
                ? this.decryptor.decrypt(targetDoc.encryptedPayload, targetDoc.iv, targetDoc.authTag)
                : {};

            // Step 3: Acquire distributed Redlock — prevents concurrent destructive writes
            lock = targetCredentialId ? await this.lockService.acquire(tenantId, targetCredentialId) : null;

            // Step 4: Build context — the Orchestrator handles connector creation per entity type
            const context: EtlContext = {
                tenantId,
                jobId,
                correlationId: job.id || jobId,
                lockToken: undefined, // lockToken tracked by LockService internally
                sourceCredentials,
                targetCredentials,
                entityTypes: entityTypes?.length ? entityTypes : ['PRODUCTS'],
            };

            // Step 5: Delegate to Orchestrator — it creates connectors and runs the EtlEngine per entity type
            await this.orchestrator.execute({
                jobKind: kind,
                context,
                sourcePlatform: sourceDoc.platform,
                targetPlatform: targetDoc?.platform ?? sourceDoc.platform,
            });

            this.logger.log(`[${jobId}] ETL job completed successfully`);
        } catch (error) {
            this.logger.error(`[${jobId}] ETL job failed: ${(error as Error).message}`, (error as Error).stack);
            throw error; // BullMQ handles retries and final DLQ routing
        } finally {
            // Always release lock — even if job fails or throws
            await this.lockService.release(lock);
        }
    }
}
