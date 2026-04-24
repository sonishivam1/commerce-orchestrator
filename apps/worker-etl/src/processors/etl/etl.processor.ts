import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { randomBytes, createDecipheriv } from 'crypto';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { ConnectorFactory } from '@cdo/connectors';
import { EtlContext } from '@cdo/core';
import { ErrorType, QUEUE_ETL } from '@cdo/shared';

@Processor(QUEUE_ETL)
export class EtlProcessor extends WorkerHost {
    private readonly logger = new Logger(EtlProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: DataEtlOrchestrator
    ) {
        super();
    }

    private decryptCredentials(encryptedPayload: string, ivHex: string, authTagHex: string): Record<string, unknown> {
        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== 64) {
            this.logger.warn('CREDENTIAL_KEY is missing or invalid. Using fallback mock decryption for dev.');
            // Fallback for dev without strict encryption key
            if (encryptedPayload.startsWith('{')) {
                return JSON.parse(encryptedPayload);
            }
            return {};
        }

        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    async process(job: Job): Promise<void> {
        const { tenantId, jobId, kind, sourceCredentialId, targetCredentialId } = job.data;

        this.logger.log(`Starting ETL Job ${jobId} for tenant ${tenantId} (${kind})`);

        try {
            // Step 1: Fetch credentials
            const sourceDoc = await this.credentialRepository.findOneDecrypted(tenantId, sourceCredentialId);
            const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

            if (!sourceDoc || !targetDoc) {
                throw new Error('Missing source or target credentials required for job execution');
            }

            const sourceCredentials = this.decryptCredentials(sourceDoc.encryptedPayload, sourceDoc.iv, sourceDoc.authTag);
            const targetCredentials = this.decryptCredentials(targetDoc.encryptedPayload, targetDoc.iv, targetDoc.authTag);

            // Step 2: Acquire Redis Redlock
            // TODO: Redis Redlock (Phase 3 distributed locking implementation)

            // Step 3: Instantiate Connectors
            const source = ConnectorFactory.createSource(sourceDoc.platform);
            const target = ConnectorFactory.createTarget(targetDoc.platform);

            // Step 4: Hand off to Orchestrator
            const context: EtlContext = {
                tenantId,
                jobId,
                correlationId: job.id || jobId,
                sourceCredentials,
                targetCredentials,
            };

            await this.orchestrator.execute({
                jobKind: kind,
                source,
                target,
                context,
            });

            this.logger.log(`Job ${jobId} completed successfully.`);

        } catch (error) {
            this.logger.error(`Job ${jobId} failed: ${(error as Error).message}`, (error as Error).stack);
            throw error; // Let BullMQ handle retries and DLQ routing
        } finally {
            // Step 6: Release Redlock
        }
    }
}
