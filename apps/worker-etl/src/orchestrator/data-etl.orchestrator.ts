import { Injectable, Logger } from '@nestjs/common';
import { EtlEngine, type EtlContext, type LoadResult } from '@cdo/core';
import { EntityType, ErrorType, type CanonicalEntity, JobKind } from '@cdo/shared';
import { ConnectorFactory } from '@cdo/connectors';
import { JobRepository, DlqRepository } from '@cdo/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface JobStrategyConfig {
    jobKind: string;
    /** Resolved platform string from the source credential document (e.g. 'commercetools'). */
    sourcePlatform: string;
    /** Resolved platform string from the target credential document. */
    targetPlatform: string;
    context: EtlContext;
    /** For EXPORT jobs: destination directory for the output file */
    exportDir?: string;
}

/**
 * DataEtlOrchestrator — orchestrates the ETL pipeline for a single job.
 *
 * Handles all four job kinds:
 * - CROSS_PLATFORM_MIGRATION: Source → Canonical → Target (one pass per entity type)
 * - PLATFORM_CLONE: Phase 1 schema replication, Phase 2 entity replication
 * - SCRAPE_IMPORT: Playwright → Canonical → Target
 * - EXPORT: Source → Canonical → JSONL file on disk
 *
 * The Orchestrator owns connector creation via ConnectorFactory — the Worker
 * processor only handles infrastructure concerns (credential decryption, Redlock).
 */
@Injectable()
export class DataEtlOrchestrator {
    private readonly logger = new Logger(DataEtlOrchestrator.name);

    constructor(
        private readonly jobRepository: JobRepository,
        private readonly dlqRepository: DlqRepository,
    ) {}

    async execute(config: JobStrategyConfig): Promise<void> {
        switch (config.jobKind) {
            case JobKind.PLATFORM_CLONE:
                return this.executePlatformClone(config);
            case JobKind.EXPORT:
                return this.executeExport(config);
            case JobKind.CROSS_PLATFORM_MIGRATION:
            case JobKind.SCRAPE_IMPORT:
            default:
                return this.executeStandardEtl(config);
        }
    }

    // ── Standard ETL (CROSS_PLATFORM_MIGRATION / SCRAPE_IMPORT) ──────────────

    private async executeStandardEtl(config: JobStrategyConfig): Promise<void> {
        const { sourcePlatform, targetPlatform, context } = config;
        const entityTypes = context.entityTypes?.length ? context.entityTypes as EntityType[] : [EntityType.PRODUCTS];

        let totalProcessed = 0;
        let totalFailed = 0;

        for (const entityType of entityTypes) {
            this.logger.log(`[${context.jobId}] ETL pass — entityType=${entityType} source=${sourcePlatform} → target=${targetPlatform}`);

            const source = ConnectorFactory.createSource(sourcePlatform, entityType);
            const target = ConnectorFactory.createTarget(targetPlatform, entityType);

            const engine = new EtlEngine(source, target, context);

            engine.on('progress', async (results: LoadResult[]) => {
                const ok = results.filter((r) => r.success).length;
                const fail = results.filter((r) => !r.success).length;
                totalProcessed += ok + fail;
                totalFailed += fail;
                this.logger.log(`[${context.jobId}][${entityType}] +${ok} ok / +${fail} failed`);
                this.jobRepository
                    .updateProgress(context.jobId, totalProcessed, totalFailed)
                    .catch((e) => this.logger.error(`Progress update failed: ${e.message}`));
            });

            engine.on('failure', async (error: any, item: CanonicalEntity | undefined) => {
                this.logger.error(`[${context.jobId}][${entityType}] Item failure: ${error.message}`);
                if (item) {
                    await this.pushToDlq(context, item, error).catch((e) =>
                        this.logger.error(`DLQ push failed for ${item.key}: ${e.message}`),
                    );
                }
            });

            try {
                await engine.run();
            } catch (error) {
                // Fail the whole job if a fatal error occurs on any entity type
                await this.jobRepository.markFailed(context.jobId, {
                    message: (error as Error).message,
                    entityType,
                    stack: (error as Error).stack,
                });
                throw error;
            }
        }

        await this.jobRepository.markCompleted(context.jobId);
    }

    // ── PLATFORM_CLONE — two-phase: schema first, then entities ──────────────

    private async executePlatformClone(config: JobStrategyConfig): Promise<void> {
        const { sourcePlatform, targetPlatform, context } = config;

        this.logger.log(`[${context.jobId}] PLATFORM_CLONE Phase 1: schema replication`);

        // Phase 1: replicate the taxonomy / schema from source → target (products only for schema)
        try {
            const source = ConnectorFactory.createSource(sourcePlatform, EntityType.PRODUCTS);
            const target = ConnectorFactory.createTarget(targetPlatform, EntityType.PRODUCTS);

            if (typeof (source as any).extractSchema === 'function') {
                const schema = await (source as any).extractSchema(context.sourceCredentials);
                this.logger.log(`[${context.jobId}] Schema extracted, deploying to target...`);

                if (typeof (target as any).deploySchema === 'function') {
                    await (target as any).deploySchema(schema, context.targetCredentials);
                    this.logger.log(`[${context.jobId}] Schema deployed ✓`);
                } else {
                    this.logger.warn(`[${context.jobId}] Target connector does not implement deploySchema — skipping schema phase`);
                }
            } else {
                this.logger.warn(`[${context.jobId}] Source connector does not implement extractSchema — skipping schema phase`);
            }
        } catch (err) {
            this.logger.error(`[${context.jobId}] Schema replication failed: ${(err as Error).message}`);
            await this.jobRepository.markFailed(context.jobId, {
                message: `Schema replication failed: ${(err as Error).message}`,
                phase: 'schema',
            });
            throw err;
        }

        this.logger.log(`[${context.jobId}] PLATFORM_CLONE Phase 2: entity replication`);

        // Phase 2: run standard ETL for all requested entity types
        await this.executeStandardEtl(config);
    }

    // ── EXPORT — Source → Canonical → JSONL file ──────────────────────────────

    private async executeExport(config: JobStrategyConfig): Promise<void> {
        const { sourcePlatform, context, exportDir } = config;
        const entityTypes = context.entityTypes?.length ? context.entityTypes as EntityType[] : [EntityType.PRODUCTS];
        const outputDir = exportDir ?? join(process.cwd(), 'exports');
        const outputFile = join(outputDir, `export-${context.jobId}.jsonl`);

        this.logger.log(`[${context.jobId}] EXPORT job — writing to ${outputFile} entityTypes=${entityTypes.join(',')}`);

        await mkdir(outputDir, { recursive: true });

        let totalProcessed = 0;
        let firstWrite = true;

        try {
            for (const entityType of entityTypes) {
                this.logger.log(`[${context.jobId}] EXPORT — extracting ${entityType}`);
                const source = ConnectorFactory.createSource(sourcePlatform, entityType);
                await source.initialize(context.sourceCredentials);

                const lines: string[] = [];

                for await (const batch of source.extract()) {
                    for (const item of batch) {
                        lines.push(JSON.stringify({ _entityType: entityType, ...item }));
                        totalProcessed++;
                    }

                    // Flush to disk every 1000 items to keep memory bounded
                    if (lines.length >= 1000) {
                        await writeFile(outputFile, lines.join('\n') + '\n', {
                            flag: firstWrite ? 'w' : 'a',
                            encoding: 'utf8',
                        });
                        firstWrite = false;
                        lines.length = 0;

                        await this.jobRepository.updateProgress(context.jobId, totalProcessed, 0);
                        this.logger.log(`[${context.jobId}] EXPORT — ${totalProcessed} items written`);
                    }
                }

                // Flush remaining for this entity type
                if (lines.length > 0) {
                    await writeFile(outputFile, lines.join('\n') + '\n', {
                        flag: firstWrite ? 'w' : 'a',
                        encoding: 'utf8',
                    });
                    firstWrite = false;
                }
            }

            await this.jobRepository.updateProgress(context.jobId, totalProcessed, 0);
            await this.jobRepository.markCompleted(context.jobId, outputFile);
            this.logger.log(`[${context.jobId}] EXPORT complete — ${totalProcessed} items → ${outputFile}`);
        } catch (error) {
            await this.jobRepository.markFailed(context.jobId, {
                message: (error as Error).message,
                stack: (error as Error).stack,
            });
            throw error;
        }
    }

    // ── Shared helpers ─────────────────────────────────────────────────────────

    private async pushToDlq(
        context: EtlContext,
        item: CanonicalEntity,
        error: Error & { type?: ErrorType },
    ): Promise<void> {
        await this.dlqRepository.create({
            tenantId: context.tenantId,
            jobId: context.jobId,
            itemKey: item.key ?? 'unknown',
            errorType: error.type ?? ErrorType.FATAL,
            errorMessage: error.message,
            rawPayload: item as unknown as Record<string, unknown>,
            canReplay: error.type !== ErrorType.VALIDATION,
        });
    }
}
