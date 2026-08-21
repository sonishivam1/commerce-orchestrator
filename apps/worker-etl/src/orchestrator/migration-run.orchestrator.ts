import { Injectable, Logger } from '@nestjs/common';
import { EntityType, MigrationRunStatus } from '@cdo/shared';
import { planWaves } from '@cdo/core';
import {
    MigrationProjectRepository,
    MigrationRunRepository,
    IdentityMapRepository,
    ReconciliationReportRepository,
    CredentialRepository,
} from '@cdo/db';
import { EtlContext } from '@cdo/core';
import { WaveExecutorService, WaveStats } from './wave-executor.service';
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
 * Responsibilities:
 * 1. Load MigrationRun + MigrationProject from DB.
 * 2. Decrypt source + target credentials (delegated to CredentialDecryptor).
 * 3. Plan waves via WavePlanner (dependency-driven topological sort).
 * 4. Execute each wave in order via WaveExecutorService.
 * 5. On any wave failure: mark the run FAILED with an error summary.
 * 6. On full success: mark the run COMPLETED and generate ReconciliationReport.
 *
 * The orchestrator does NOT acquire Redlock — that is the EtlProcessor's
 * responsibility (infra concern). The orchestrator is pure domain logic.
 */
@Injectable()
export class MigrationRunOrchestrator {
    private readonly logger = new Logger(MigrationRunOrchestrator.name);

    constructor(
        private readonly projectRepository: MigrationProjectRepository,
        private readonly runRepository: MigrationRunRepository,
        private readonly identityMapRepository: IdentityMapRepository,
        private readonly reportRepository: ReconciliationReportRepository,
        private readonly credentialRepository: CredentialRepository,
        private readonly waveExecutor: WaveExecutorService,
        private readonly decryptor: CredentialDecryptor,
    ) {}

    async execute(payload: MigrationRunJobPayload): Promise<void> {
        const { tenantId, migrationRunId, correlationId, dryRun } = payload;

        // Step 1: Load the run and its project
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
            throw new Error(
                `MigrationProject not found for run=${migrationRunId}`,
            );
        }

        const migrationProjectId = String(project._id);
        const runId = String(run._id);

        this.logger.log(
            `[${runId}] MigrationRun starting — ` +
                `project="${project.name}" entityTypes=${project.entityTypes.join(',')} dryRun=${dryRun}`,
        );

        // Step 2: Mark run RUNNING
        await this.runRepository.markRunning(runId);

        // Step 3: Decrypt credentials — only ever done in worker memory
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

        // Step 4: Plan waves — topological sort of selected entity types
        const entityTypes = project.entityTypes as EntityType[];
        const plannedWaves = planWaves(entityTypes);

        this.logger.log(
            `[${runId}] Wave plan: ${plannedWaves.join(' → ')}`,
        );

        // Base EtlContext shared across all waves
        const baseContext: EtlContext = {
            tenantId,
            jobId: runId,
            correlationId,
            sourceCredentials,
            targetCredentials,
            migrationProjectId,
            dryRun,
        };

        // Step 5: Execute waves in dependency order
        const waveStatsMap: Record<string, WaveStats> = {};

        for (const entityType of plannedWaves) {
            // Read persisted cursor from the wave stub — present when:
            //   (a) This wave partially completed in a previous run and the B1 resume
            //       flow copied the cursor into this run at creation time, OR
            //   (b) This wave started but crashed mid-run and checkpointed a cursor.
            // In both cases we forward it as startCursor so extraction resumes from
            // the correct position rather than re-processing items from the beginning.
            const waveRecord = run.waves?.find((w) => w.entityType === entityType);
            const startCursor = waveRecord?.cursor;

            if (startCursor) {
                this.logger.log(
                    `[${runId}] Wave ${entityType} resuming from cursor=${startCursor}`,
                );
            }

            try {
                const stats = await this.waveExecutor.executeWave({
                    entityType,
                    plannedWaves,
                    run: {
                        _id: runId,
                        tenantId,
                        migrationProjectId,
                        dryRun,
                    },
                    sourcePlatform: sourceDoc.platform,
                    targetPlatform: targetDoc.platform,
                    sourceCredentials,
                    targetCredentials,
                    context: baseContext,
                    startCursor,
                });
                waveStatsMap[entityType] = stats;
            } catch (error) {
                const errorSummary = {
                    message: (error as Error).message,
                    entityType,
                    stack: (error as Error).stack,
                };
                await this.failRun(runId, errorSummary);
                this.logger.error(
                    `[${runId}] Run FAILED on wave ${entityType}: ${(error as Error).message}`,
                );
                return;
            }
        }

        // Step 6: Mark run COMPLETED
        await this.runRepository.markCompleted(runId);

        this.logger.log(`[${runId}] MigrationRun COMPLETED — all ${plannedWaves.length} waves finished`);

        // Step 7: Generate ReconciliationReport (skip for dryRun — no real data written)
        if (!dryRun) {
            await this.generateReport({
                tenantId,
                migrationRunId: runId,
                migrationProjectId,
                entityTypes,
                plannedWaves,
                waveStatsMap,
            });
        } else {
            this.logger.log(`[${runId}] dryRun=true — ReconciliationReport skipped`);
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private async failRun(runId: string, errorSummary: Record<string, unknown>): Promise<void> {
        await this.runRepository
            .markFailed(runId, errorSummary)
            .catch((e: Error) =>
                this.logger.error(`[${runId}] Failed to mark run as FAILED: ${e.message}`),
            );
    }

    private async generateReport(params: {
        tenantId: string;
        migrationRunId: string;
        migrationProjectId: string;
        entityTypes: EntityType[];
        plannedWaves: EntityType[];
        waveStatsMap: Record<string, WaveStats>;
    }): Promise<void> {
        const { tenantId, migrationRunId, migrationProjectId, entityTypes, waveStatsMap } = params;

        try {
            const entitySummaries = await Promise.all(
                entityTypes.map(async (entityType) => {
                    const stats = waveStatsMap[entityType];
                    const migratedCount = await this.identityMapRepository.countForEntityType(
                        tenantId,
                        migrationProjectId,
                        entityType,
                    );

                    const sourceCount = stats
                        ? stats.processedCount + stats.failedCount
                        : 0;

                    return {
                        entityType,
                        sourceCount,
                        migratedCount,
                        createdCount: stats?.created ?? 0,
                        updatedCount: stats?.updated ?? 0,
                        failedCount: stats?.failedCount ?? 0,
                        missingRefCount: stats?.missingRefCount ?? 0,
                    };
                }),
            );

            const totalMigrated = entitySummaries.reduce((sum, s) => sum + s.migratedCount, 0);
            const totalSource = entitySummaries.reduce((sum, s) => sum + s.sourceCount, 0);
            const overallSuccessRate =
                totalSource > 0
                    ? Math.round((totalMigrated / totalSource) * 10_000) / 100
                    : 100;

            await this.reportRepository.create({
                tenantId,
                migrationRunId,
                migrationProjectId,
                generatedAt: new Date(),
                overallSuccessRate,
                entitySummaries,
            });

            this.logger.log(
                `[${migrationRunId}] ReconciliationReport generated — ` +
                    `overallSuccessRate=${overallSuccessRate}% ` +
                    `entities=${entitySummaries.map((s) => `${s.entityType}:${s.migratedCount}`).join(', ')}`,
            );
        } catch (error) {
            // Report generation failure does NOT fail the run itself — the data was migrated.
            this.logger.error(
                `[${migrationRunId}] ReconciliationReport generation failed: ${(error as Error).message}`,
                (error as Error).stack,
            );
        }
    }
}
