import { Injectable, Logger } from '@nestjs/common';
import { EntityType, planEntityWaves } from '@cdo/shared';
import {
    MigrationProjectRepository,
    MigrationRunRepository,
    CredentialRepository,
} from '@cdo/db';
import { EtlContext } from '@cdo/core';
import { WaveExecutorService } from './wave-executor.service';
import { CredentialDecryptor } from '../services/credential.decryptor';

export interface MigrationRunJobPayload {
    tenantId: string;
    migrationRunId: string;
    /** correlationId from the MigrationRun document */
    correlationId: string;
    dryRun: boolean;
}

/**
 * MigrationRunOrchestrator — coordinates the full execution of a MigrationRun.
 *
 * 1. Load MigrationRun + MigrationProject.
 * 2. Decrypt source + target credentials (worker memory only).
 * 3. Order the selected entity types by the fixed canonical wave order.
 * 4. Execute each wave via WaveExecutorService.
 * 5. Mark the run FAILED (with an error summary) or COMPLETED.
 *
 * Pure domain logic — concurrency guarding lives in the API (a project rejects a
 * second run while one is RUNNING), not here.
 */
@Injectable()
export class MigrationRunOrchestrator {
    private readonly logger = new Logger(MigrationRunOrchestrator.name);

    constructor(
        private readonly projectRepository: MigrationProjectRepository,
        private readonly runRepository: MigrationRunRepository,
        private readonly credentialRepository: CredentialRepository,
        private readonly waveExecutor: WaveExecutorService,
        private readonly decryptor: CredentialDecryptor,
    ) {}

    async execute(payload: MigrationRunJobPayload): Promise<void> {
        const { tenantId, migrationRunId, correlationId, dryRun } = payload;

        const run = await this.runRepository.findOneForTenant(tenantId, migrationRunId);
        if (!run) {
            throw new Error(
                `MigrationRun not found — tenantId=${tenantId} runId=${migrationRunId}`,
            );
        }

        const project = await this.projectRepository.findOneForTenant(
            tenantId,
            String(run.migrationProjectId),
        );
        if (!project) {
            throw new Error(`MigrationProject not found for run=${migrationRunId}`);
        }

        const migrationProjectId = String(project._id);
        const runId = String(run._id);

        this.logger.log(
            `[${runId}] MigrationRun starting — ` +
                `project="${project.name}" entityTypes=${project.entityTypes.join(',')} dryRun=${dryRun}`,
        );

        await this.runRepository.markRunning(runId);

        // Decrypt credentials — only ever done in worker memory
        const sourceDoc = await this.credentialRepository.findOneDecrypted(
            tenantId,
            project.sourceConnectionId,
        );
        if (!sourceDoc) {
            await this.failRun(runId, { message: `Source credential not found: ${project.sourceConnectionId}` });
            return;
        }

        const targetDoc = await this.credentialRepository.findOneDecrypted(
            tenantId,
            project.targetConnectionId,
        );
        if (!targetDoc) {
            await this.failRun(runId, { message: `Target credential not found: ${project.targetConnectionId}` });
            return;
        }

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

        const plannedWaves = planEntityWaves(project.entityTypes as EntityType[]);

        this.logger.log(`[${runId}] Wave plan: ${plannedWaves.join(' → ')}`);

        const baseContext: EtlContext = {
            tenantId,
            jobId: runId,
            correlationId,
            sourceCredentials,
            targetCredentials,
            migrationProjectId,
            dryRun,
        };

        for (const entityType of plannedWaves) {
            const waveRecord = run.waves?.find((w) => w.entityType === entityType);
            const startCursor = waveRecord?.cursor;

            if (startCursor) {
                this.logger.log(
                    `[${runId}] Wave ${entityType} resuming from cursor=${startCursor}`,
                );
            }

            try {
                await this.waveExecutor.executeWave({
                    entityType,
                    plannedWaves,
                    run: { _id: runId, tenantId, migrationProjectId, dryRun },
                    sourcePlatform: sourceDoc.platform,
                    targetPlatform: targetDoc.platform,
                    sourceCredentials,
                    targetCredentials,
                    context: baseContext,
                    startCursor,
                });
            } catch (error) {
                await this.failRun(runId, {
                    message: (error as Error).message,
                    entityType,
                    stack: (error as Error).stack,
                });
                this.logger.error(
                    `[${runId}] Run FAILED on wave ${entityType}: ${(error as Error).message}`,
                );
                return;
            }
        }

        await this.runRepository.markCompleted(runId);
        this.logger.log(
            `[${runId}] MigrationRun COMPLETED — all ${plannedWaves.length} waves finished`,
        );
    }

    private async failRun(runId: string, errorSummary: Record<string, unknown>): Promise<void> {
        await this.runRepository
            .markFailed(runId, errorSummary)
            .catch((e: Error) =>
                this.logger.error(`[${runId}] Failed to mark run as FAILED: ${e.message}`),
            );
    }
}
