import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { randomBytes, createDecipheriv } from 'crypto';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { ConnectorFactory } from '@cdo/connectors';
import { ScrapeSourceConnector } from '@cdo/ingestion';
import { EtlContext } from '@cdo/core';
import { QUEUE_SCRAPE } from '@cdo/shared';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';

@Processor(QUEUE_SCRAPE)
export class ScrapeProcessor extends WorkerHost {
    private readonly logger = new Logger(ScrapeProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: ScrapeOrchestrator
    ) {
        super();
    }

    private decryptCredentials(encryptedPayload: string, ivHex: string, authTagHex: string): Record<string, unknown> {
        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== 64) {
            this.logger.warn('CREDENTIAL_KEY is missing or invalid. Using fallback mock decryption for dev.');
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
        const { tenantId, jobId, kind, sourceUrl, targetCredentialId } = job.data;

        this.logger.log(`Starting Scrape Job ${jobId} | Tenant ${tenantId} | URL: ${sourceUrl}`);

        try {
            // Step 1: Fetch target credentials (Scrapers don't have source credentials, they use public sourceUrl)
            const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

            if (!targetDoc) {
                throw new Error('Missing target credentials required for Scrape job execution');
            }

            const targetCredentials = this.decryptCredentials(targetDoc.encryptedPayload, targetDoc.iv, targetDoc.authTag);

            // Scrape jobs pass the URL via sourceCredentials interface to the SourceConnector adapter
            const sourceCredentials = { sourceUrl, concurrency: 3 };

            // Step 2: Acquire Redis Redlock (Phase 3)
            
            // Step 3: Instantiate Connectors
            // The Scraper acts as our Source Connector
            const source = new ScrapeSourceConnector();
            // The chosen target platform is instantiated via ConnectorFactory
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

            this.logger.log(`Scrape Job ${jobId} completed successfully.`);

        } catch (error) {
            this.logger.error(`Scrape Job ${jobId} failed: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        } finally {
            // Step 6: Release Redlock
        }
    }
}
