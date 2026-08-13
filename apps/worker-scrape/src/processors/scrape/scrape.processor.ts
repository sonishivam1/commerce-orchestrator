import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { ConnectorFactory } from '@cdo/connectors';
import { ScrapeSourceConnector } from '@cdo/ingestion';
import { EtlContext } from '@cdo/core';
import { QUEUE_SCRAPE, JobStatus } from '@cdo/shared';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';
import { LockService } from '../../services/lock.service';
import { CredentialDecryptorService } from '../../services/credential-decryptor.service';
import type { Lock } from 'redlock';
import { AsyncContextService } from '../../common/context/async-context.service';

@Processor(QUEUE_SCRAPE)
export class ScrapeProcessor extends WorkerHost {
    private readonly logger = new Logger(ScrapeProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: ScrapeOrchestrator,
        private readonly lockService: LockService,
        private readonly credentialDecryptor: CredentialDecryptorService,
        private readonly asyncContext: AsyncContextService
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { tenantId, jobId, kind, sourceUrl, targetCredentialId, correlationId, traceId } = job.data;

        await this.asyncContext.run({ tenantId, jobId, traceId, correlationId }, async () => {
            this.logger.log(`Starting Scrape Job ${jobId} | Tenant ${tenantId} | URL: ${sourceUrl}`);

            let lock: Lock | undefined;
            try {
                // 1. Transition to RUNNING immediately
                await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.RUNNING);

                // 2. Acquire Redlock before any target operations
                lock = await this.lockService.acquire(tenantId, targetCredentialId);

                // 3. Fetch and decrypt target credentials (Scrapers don't have source credentials, they use public sourceUrl)
                const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

                if (!targetDoc) {
                    throw new Error('Missing target credentials required for Scrape job execution');
                }

                const targetCredentials = await this.credentialDecryptor.decrypt(tenantId, targetCredentialId);

                // Scrape jobs pass the URL via sourceCredentials interface to the SourceConnector adapter
                const sourceCredentials = { sourceUrl, concurrency: 3 };

                // 4. Instantiate Connectors
                // The Scraper acts as our Source Connector
                const source = new ScrapeSourceConnector();
                // The chosen target platform is instantiated via ConnectorFactory
                const target = ConnectorFactory.createTarget(targetDoc.platform);

                // 5. Hand off to Orchestrator
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
                    lock,
                    lockService: this.lockService,
                });

                this.logger.log(`Scrape Job ${jobId} completed successfully.`);

            } catch (error) {
                this.logger.error(`Scrape Job ${jobId} failed: ${(error as Error).message}`, (error as Error).stack);
                await this.jobRepository.markFailed(jobId, { message: (error as Error).message });
                throw error;
            } finally {
                // ALWAYS release — even on error
                if (lock) await this.lockService.release(lock);
            }
        });
    }
}
