import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MigrationRunOrchestrator } from '../../orchestrator/migration-run.orchestrator';
import { QUEUE_ETL } from '@cdo/shared';

/**
 * Processes MIGRATION_RUN jobs from the ETL queue.
 *
 * The processor only picks up the job and delegates to the orchestrator. All
 * domain logic (wave planning, identity map, run status) lives there.
 * Concurrency is guarded in the API (a project rejects a second run while one
 * is RUNNING), so no distributed lock is acquired here.
 */
@Processor(QUEUE_ETL)
export class EtlProcessor extends WorkerHost {
    private readonly logger = new Logger(EtlProcessor.name);

    constructor(
        private readonly migrationRunOrchestrator: MigrationRunOrchestrator,
    ) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { tenantId, migrationRunId, dryRun, correlationId } = job.data;

        this.logger.log(
            `[${migrationRunId}] MIGRATION_RUN picked up — tenant=${tenantId} dryRun=${dryRun ?? false}`,
        );

        try {
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
        }
    }
}
