import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { ConnectorFactory } from '@cdo/connectors';
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
        const { tenantId, jobId, kind, sourceCredentialId, targetCredentialId } = job.data;

        this.logger.log(`[${jobId}] ETL job picked up — kind=${kind} tenant=${tenantId}`);

        // Mark RUNNING immediately so the UI reflects live status
        await this.jobRepository.markRunning(jobId);

        let lock = null;

        try {
            // Step 1: Fetch encrypted credentials from DB
            const sourceDoc = await this.credentialRepository.findOneDecrypted(tenantId, sourceCredentialId);
            const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

            if (!sourceDoc || !targetDoc) {
                throw new Error(`Missing credentials — sourceCredentialId=${sourceCredentialId} targetCredentialId=${targetCredentialId}`);
            }

            // Step 2: Decrypt credentials in worker memory only
            const sourceCredentials = this.decryptor.decrypt(
                sourceDoc.encryptedPayload,
                sourceDoc.iv,
                sourceDoc.authTag,
            );
            const targetCredentials = this.decryptor.decrypt(
                targetDoc.encryptedPayload,
                targetDoc.iv,
                targetDoc.authTag,
            );

            // Step 3: Acquire distributed Redlock — prevents concurrent destructive writes
            lock = await this.lockService.acquire(tenantId, targetCredentialId);

            // Step 4: Instantiate connectors for this platform pair
            const source = ConnectorFactory.createSource(sourceDoc.platform);
            const target = ConnectorFactory.createTarget(targetDoc.platform);

            // Step 5: Build context and hand off to orchestrator
            const context: EtlContext = {
                tenantId,
                jobId,
                correlationId: job.id || jobId,
                lockToken: undefined, // lockToken tracked by LockService internally
                sourceCredentials,
                targetCredentials,
            };

            await this.orchestrator.execute({ jobKind: kind, source, target, context });

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
