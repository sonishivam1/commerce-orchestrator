import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CredentialRepository, JobRepository } from '@cdo/db';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { ConnectorFactory } from '@cdo/connectors';
import { EtlContext } from '@cdo/core';
import { ErrorType, QUEUE_ETL, JobStatus } from '@cdo/shared';
import { LockService } from '../../services/lock.service';
import { CredentialDecryptorService } from '../../services/credential-decryptor.service';
import type { Lock } from 'redlock';
import { AsyncContextService } from '../../common/context/async-context.service';

@Processor(QUEUE_ETL)
export class EtlProcessor extends WorkerHost {
    private readonly logger = new Logger(EtlProcessor.name);

    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly jobRepository: JobRepository,
        private readonly orchestrator: DataEtlOrchestrator,
        private readonly lockService: LockService,
        private readonly credentialDecryptor: CredentialDecryptorService,
        private readonly asyncContext: AsyncContextService
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { tenantId, jobId, kind, sourceCredentialId, targetCredentialId, correlationId, traceId } = job.data;

        await this.asyncContext.run({ tenantId, jobId, traceId, correlationId }, async () => {
            this.logger.log(`Starting ETL Job ${jobId} for tenant ${tenantId} (${kind})`);

            let lock: Lock | undefined;
            try {
                // 1. Transition to RUNNING immediately
                await this.jobRepository.updateStatus(tenantId, jobId, JobStatus.RUNNING);

                // 2. Acquire Redlock before any target operations
                lock = await this.lockService.acquire(tenantId, targetCredentialId);

                // 3. Fetch and decrypt credentials
                const sourceDoc = await this.credentialRepository.findOneDecrypted(tenantId, sourceCredentialId);
                const targetDoc = await this.credentialRepository.findOneDecrypted(tenantId, targetCredentialId);

                if (!sourceDoc || !targetDoc) {
                    throw new Error('Missing source or target credentials required for job execution');
                }

                const sourceCredentials = await this.credentialDecryptor.decrypt(tenantId, sourceCredentialId);
                const targetCredentials = await this.credentialDecryptor.decrypt(tenantId, targetCredentialId);

                // 3. Instantiate Connectors
                const source = ConnectorFactory.createSource(sourceDoc.platform);
                const target = ConnectorFactory.createTarget(targetDoc.platform);

                // 4. Hand off to Orchestrator
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

                this.logger.log(`Job ${jobId} completed successfully.`);

            } catch (error) {
                this.logger.error(`Job ${jobId} failed: ${(error as Error).message}`, (error as Error).stack);
                await this.jobRepository.markFailed(jobId, { message: (error as Error).message });
                throw error; // Let BullMQ handle retries and DLQ routing
            } finally {
                // ALWAYS release — even on error
                if (lock) await this.lockService.release(lock);
            }
        });
    }
}
