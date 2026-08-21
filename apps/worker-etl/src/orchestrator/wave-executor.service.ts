import { Injectable, Logger } from '@nestjs/common';
import { EtlEngine, EtlContext, LoadResult, DryRunTargetConnector, getWaveDependencies } from '@cdo/core';
import { EntityType, ErrorType, WaveStatus, type CanonicalEntity } from '@cdo/shared';
import { ConnectorFactory } from '@cdo/connectors';
import {
    IdentityMapRepository,
    MigrationRunRepository,
    DlqRepository,
} from '@cdo/db';

export interface WaveStats {
    processedCount: number;
    failedCount: number;
    created: number;
    updated: number;
    missingRefCount: number;
    cursor?: string;
}

export interface WaveExecutionConfig {
    entityType: EntityType;
    /** All waves planned for this run — used to look up which dep maps to load */
    plannedWaves: EntityType[];
    run: {
        _id: string;
        tenantId: string;
        migrationProjectId: string;
        dryRun: boolean;
    };
    sourcePlatform: string;
    targetPlatform: string;
    /** Decrypted source credentials (from worker memory only) */
    sourceCredentials: Record<string, unknown>;
    /** Decrypted target credentials (from worker memory only) */
    targetCredentials: Record<string, unknown>;
    context: EtlContext;
    /**
     * Opaque resume cursor inherited from a previous run (B1 resume) or from an
     * earlier partial execution of this wave.  When present it is forwarded to
     * the EtlEngine context as `startCursor`, which passes it to source.extract().
     * When absent the wave starts from the beginning of the dataset.
     */
    startCursor?: string;
}

/**
 * WaveExecutorService — executes a single entity-type wave within a MigrationRun.
 *
 * Responsibilities:
 * 1. Mark the wave RUNNING in the MigrationRun document.
 * 2. Load IdentityMap resolution maps for any dependency entity types.
 * 3. Inject resolution maps into the target connector credentials so the
 *    connector can resolve cross-entity references (e.g. CT category key → Shopify ID).
 * 4. Run EtlEngine for this entity type.
 * 5. On each progress batch, write successful LoadResult.targetId values to IdentityMap.
 * 6. On each failure, push items to DLQ.
 * 7. Mark the wave COMPLETED or FAILED and return stats for the run coordinator.
 *
 * The EtlEngine is NOT modified — this service is the seam between the migration
 * domain model and the existing ETL engine.
 */
@Injectable()
export class WaveExecutorService {
    private readonly logger = new Logger(WaveExecutorService.name);

    constructor(
        private readonly identityMapRepository: IdentityMapRepository,
        private readonly migrationRunRepository: MigrationRunRepository,
        private readonly dlqRepository: DlqRepository,
    ) {}

    async executeWave(config: WaveExecutionConfig): Promise<WaveStats> {
        const {
            entityType,
            plannedWaves,
            run,
            sourcePlatform,
            targetPlatform,
            sourceCredentials,
            targetCredentials,
            context,
            startCursor,
        } = config;

        const { tenantId, migrationProjectId } = run;
        const runId = String(run._id);

        this.logger.log(
            `[${runId}] Wave START — entityType=${entityType} dryRun=${run.dryRun}`,
        );

        // Step 1: Mark wave RUNNING
        await this.migrationRunRepository.updateWave(runId, entityType, {
            status: WaveStatus.RUNNING,
            startedAt: new Date(),
        });

        const stats: WaveStats = {
            processedCount: 0,
            failedCount: 0,
            created: 0,
            updated: 0,
            missingRefCount: 0,
        };

        try {
            // Step 2: Load resolution maps for dependency entity types
            const deps = getWaveDependencies(entityType, plannedWaves);
            const resolutionMaps: Record<string, Record<string, string>> = {};

            for (const dep of deps) {
                const map = await this.identityMapRepository.getResolutionMap(
                    tenantId,
                    migrationProjectId,
                    dep,
                );
                resolutionMaps[dep] = Object.fromEntries(map);
                this.logger.log(
                    `[${runId}] Loaded resolution map for ${dep} — ${map.size} entries`,
                );
            }

            // Step 3: Build enhanced credentials — resolution maps are injected under
            // the well-known key '__identityMaps' so connectors can access them without
            // any interface changes. This is an internal convention, not part of the
            // TargetConnector contract.
            const enhancedTargetCredentials: Record<string, unknown> = {
                ...targetCredentials,
                __identityMaps: resolutionMaps,
            };

            // Step 4: Build enhanced context for this wave.
            // startCursor is forwarded to the EtlEngine so source.extract(startCursor)
            // resumes from the correct position (cursor-based pagination).
            const waveContext: EtlContext = {
                ...context,
                entityTypes: [entityType],
                startCursor,
            };

            // Step 5: Create connectors
            const source = ConnectorFactory.createSource(sourcePlatform, entityType);
            const realTarget = ConnectorFactory.createTarget(targetPlatform, entityType);

            // Step 6: Wrap target in DryRunTargetConnector if dryRun is enabled
            const target = run.dryRun
                ? new DryRunTargetConnector(realTarget)
                : realTarget;

            // Step 7: Build and wire the EtlEngine
            const engine = new EtlEngine(source, target, {
                ...waveContext,
                sourceCredentials,
                targetCredentials: enhancedTargetCredentials,
            });

            // Step 8: Wire the progress handler — writes IdentityMap entries after each batch
            engine.on('progress', async (results: LoadResult[]) => {
                const succeeded = results.filter((r) => r.success);
                const failed = results.filter((r) => !r.success);

                stats.processedCount += succeeded.length;
                stats.failedCount += failed.length;

                // Capture cursor SYNCHRONOUSLY before any await.
                //
                // The EtlEngine calls this handler synchronously (no await) from inside
                // processTargetResults → processBatch.  At this exact moment the source
                // generator is still suspended at the yield point that emitted this
                // engine batch — so getCursor() reflects the last committed page.
                //
                // After the first await below, the event loop can resume the engine's
                // `for await` loop, which in turn resumes the generator and advances
                // currentCursor to the NEXT page.  Capturing synchronously avoids that
                // race.
                const batchCursor = source.getCursor?.();

                this.logger.log(
                    `[${runId}][${entityType}] +${succeeded.length} ok / +${failed.length} failed`,
                );

                // Write IdentityMap entries for items that got real targetIds
                // dryRun results have no targetId so this block is naturally skipped
                const identityEntries = succeeded
                    .filter((r) => r.targetId)
                    .map((r) => ({
                        tenantId,
                        migrationProjectId,
                        entityType,
                        sourceKey: r.key,
                        targetId: r.targetId!,
                    }));

                if (identityEntries.length > 0) {
                    const counts = await this.identityMapRepository.bulkUpsert(identityEntries);
                    stats.created += counts.created;
                    stats.updated += counts.updated;
                    this.logger.log(
                        `[${runId}][${entityType}] IdentityMap +${counts.created} created / +${counts.updated} updated`,
                    );
                }

                // Persist the pre-captured cursor and update progress counts.
                if (batchCursor) {
                    stats.cursor = batchCursor;
                }

                // Update wave progress + cursor in DB (fire-and-forget, non-critical path)
                const progressUpdate: Record<string, unknown> = {
                    processedCount: stats.processedCount,
                    failedCount: stats.failedCount,
                };
                if (batchCursor) progressUpdate['cursor'] = batchCursor;

                this.migrationRunRepository
                    .updateWave(runId, entityType, progressUpdate)
                    .catch((e: Error) =>
                        this.logger.error(`[${runId}] Wave progress update failed: ${e.message}`),
                    );
            });

            // Step 9: Wire the failure handler — pushes bad items to DLQ
            engine.on('failure', async (error: Error & { type?: ErrorType }, item?: CanonicalEntity) => {
                stats.failedCount += 1;
                this.logger.error(
                    `[${runId}][${entityType}] Item failure: ${error.message}`,
                );
                if (item) {
                    await this.dlqRepository
                        .create({
                            tenantId,
                            jobId: runId,
                            itemKey: item.key ?? 'unknown',
                            errorType: error.type ?? ErrorType.FATAL,
                            errorMessage: error.message,
                            rawPayload: item as unknown as Record<string, unknown>,
                            canReplay: error.type !== ErrorType.VALIDATION,
                        })
                        .catch((e: Error) =>
                            this.logger.error(
                                `[${runId}] DLQ push failed for ${item.key}: ${e.message}`,
                            ),
                        );
                }
            });

            // Step 10: Run the engine
            await engine.run();

            // Step 11: Mark wave COMPLETED
            await this.migrationRunRepository.updateWave(runId, entityType, {
                status: WaveStatus.COMPLETED,
                processedCount: stats.processedCount,
                failedCount: stats.failedCount,
                completedAt: new Date(),
            });

            this.logger.log(
                `[${runId}] Wave COMPLETED — entityType=${entityType} ` +
                    `processed=${stats.processedCount} failed=${stats.failedCount} ` +
                    `created=${stats.created} updated=${stats.updated}`,
            );
        } catch (error) {
            stats.failedCount += 1;

            await this.migrationRunRepository
                .updateWave(runId, entityType, {
                    status: WaveStatus.FAILED,
                    processedCount: stats.processedCount,
                    failedCount: stats.failedCount,
                    completedAt: new Date(),
                })
                .catch((e: Error) =>
                    this.logger.error(`[${runId}] Wave FAILED status update error: ${e.message}`),
                );

            this.logger.error(
                `[${runId}] Wave FAILED — entityType=${entityType}: ${(error as Error).message}`,
                (error as Error).stack,
            );

            throw error; // propagate to MigrationRunOrchestrator so it can fail the run
        }

        return stats;
    }
}
