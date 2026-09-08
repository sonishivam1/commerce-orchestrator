import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MigrationRunOrchestrator } from '../../orchestrator/migration-run.orchestrator';
import { QUEUE_ETL } from '@cdo/shared';
import { LockService } from '../../services/lock.service';

/**
 * Processes MIGRATION_RUN jobs from the ETL queue.
 *
 * The processor only handles infra concerns — pick up the job, acquire the
 * target lock, delegate to the orchestrator, release the lock. All domain
 * logic (wave planning, identity map, run status) lives in the orchestrator.
 */
@Processor(QUEUE_ETL)
export class EtlProcessor extends WorkerHost {
    private readonly logger = new Logger(EtlProcessor.name);

    constructor(
        private readonly migrationRunOrchestrator: MigrationRunOrchestrator,
        private readonly lockService: LockService,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const {
            tenantId,
            migrationRunId,
            targetCredentialId,
            dryRun,
            correlationId,
        } = job.data;

        this.logger.log(
            `[${migrationRunId}] MIGRATION_RUN picked up — tenant=${tenantId} dryRun=${dryRun ?? false}`,
        );

        let lock = null;

        try {
            lock = targetCredentialId
                ? await this.lockService.acquire(tenantId, targetCredentialId)
                : null;

            await this.migrationRunOrchestrator.execute({
                tenantId,
                migrationRunId,
                correlationId: correlationId ?? job.id ?? migrationRunId,
                dryRun: dryRun ?? false,
            });

            this.logger.log(`[${migrationRunId}] MIGRATION_RUN completed successfully`);
        } catch (error) {
            this.logger.error(
                `[${migrationRunId}] MIGRATION_RUN failed: ${(error as Error).message}`,
                (error as Error).stack,
            );
            // The orchestrator already marks the run FAILED via runRepository.
            // Re-throw so BullMQ can apply its retry policy.
            throw error;
        } finally {
            await this.lockService.release(lock);
        }
    }
}
