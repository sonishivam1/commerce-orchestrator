import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { ConnectorFactory } from '@cdo/connectors';
import { ScrapeSourceConnector } from '@cdo/ingestion';
import { EtlContext } from '@cdo/core';
import { QUEUE_SCRAPE } from '@cdo/shared';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Processor(QUEUE_SCRAPE)
export class ScrapeProcessor extends WorkerHost {
    private readonly logger = new Logger(ScrapeProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: ScrapeOrchestrator,
        private readonly decryptor: CredentialDecryptor,
        private readonly lockService: LockService,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { tenantId, jobId, kind, sourceUrl, targetCredentialId } = job.data;

        this.logger.log(`[${jobId}] Scrape job picked up — url=${sourceUrl} tenant=${tenantId}`);

        // Mark RUNNING immediately
        await this.jobRepository.markRunning(jobId);

        let lock = null;

        try {
            // Step 1: Fetch target credentials (scrape jobs have a public sourceUrl, no source creds)
            const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

            if (!targetDoc) {
                throw new Error(`Missing target credentials for targetCredentialId=${targetCredentialId}`);
            }

            // Step 2: Decrypt target credentials in memory
            const targetCredentials = this.decryptor.decrypt(
                targetDoc.encryptedPayload,
                targetDoc.iv,
                targetDoc.authTag,
            );

            // Pass the URL and concurrency limit via the sourceCredentials interface
            const sourceCredentials: Record<string, unknown> = {
                sourceUrl,
                concurrency: 3,
            };

            // Step 3: Acquire distributed Redlock on target
            lock = await this.lockService.acquire(tenantId, targetCredentialId);

            // Step 4: Instantiate connectors
            const source = new ScrapeSourceConnector();
            const target = ConnectorFactory.createTarget(targetDoc.platform);

            // Step 5: Build context and hand off to orchestrator
            const context: EtlContext = {
                tenantId,
                jobId,
                correlationId: job.id || jobId,
                sourceCredentials,
                targetCredentials,
            };

            await this.orchestrator.execute({ jobKind: kind, source, target, context });

            this.logger.log(`[${jobId}] Scrape job completed successfully`);
        } catch (error) {
            this.logger.error(`[${jobId}] Scrape job failed: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        } finally {
            await this.lockService.release(lock);
        }
    }
}
