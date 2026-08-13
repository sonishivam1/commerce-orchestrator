import { Injectable, Logger } from '@nestjs/common';
import { EtlEngine, type EtlContext, type LoadResult } from '@cdo/core';
import { ErrorType, type CanonicalEntity, JobKind } from '@cdo/shared';
import type { SourceConnector, TargetConnector } from '@cdo/core';
import { JobRepository, DlqRepository } from '@cdo/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface JobStrategyConfig {
    jobKind: string;
    source: SourceConnector;
    target: TargetConnector<CanonicalEntity>;
    context: EtlContext;
    /** For EXPORT jobs: destination directory for the output file */
    exportDir?: string;
}

/**
 * DataEtlOrchestrator — orchestrates the ETL pipeline for a single job.
 *
 * Handles all four job kinds:
 * - CROSS_PLATFORM_MIGRATION: Source → Canonical → Target (standard ETL)
 * - PLATFORM_CLONE: Phase 1 schema replication, Phase 2 entity replication
 * - SCRAPE_IMPORT: Playwright → Canonical → Target
 * - EXPORT: Source → Canonical → JSONL file on disk
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
        const { source, target, context } = config;
        const engine = new EtlEngine(source, target, context);
        let totalProcessed = 0;
        let totalFailed = 0;

        engine.on('progress', async (results) => {
            const ok = results.filter((r) => r.success).length;
            const fail = results.filter((r) => !r.success).length;
            totalProcessed += ok + fail;
            totalFailed += fail;
            this.logger.log(`[${context.jobId}] +${ok} ok / +${fail} failed`);
            this.jobRepository
                .updateProgress(context.jobId, totalProcessed, totalFailed)
                .catch((e) => this.logger.error(`Progress update failed: ${e.message}`));
        });

        engine.on('failure', async (error: any, item: CanonicalEntity | undefined) => {
            this.logger.error(`[${context.jobId}] Item failure: ${error.message}`);
            if (item) {
                await this.pushToDlq(context, item, error).catch((e) =>
                    this.logger.error(`DLQ push failed for ${item.key}: ${e.message}`),
                );
            }
        });

        try {
            await engine.run();
            await this.jobRepository.markCompleted(context.jobId);
        } catch (error) {
            await this.jobRepository.markFailed(context.jobId, {
                message: (error as Error).message,
                stack: (error as Error).stack,
            });
            throw error;
        }
    }

    // ── PLATFORM_CLONE — two-phase: schema first, then entities ──────────────

    private async executePlatformClone(config: JobStrategyConfig): Promise<void> {
        const { source, target, context } = config;

        this.logger.log(`[${context.jobId}] PLATFORM_CLONE Phase 1: schema replication`);

        // Phase 1: replicate the taxonomy / schema from source → target
        try {
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
            // Fail the job rather than proceeding with entity replication on a broken schema
            await this.jobRepository.markFailed(context.jobId, {
                message: `Schema replication failed: ${(err as Error).message}`,
                phase: 'schema',
            });
            throw err;
        }

        this.logger.log(`[${context.jobId}] PLATFORM_CLONE Phase 2: entity replication`);

        // Phase 2: run standard ETL for entities
        await this.executeStandardEtl(config);
    }

    // ── EXPORT — Source → Canonical → JSONL file ──────────────────────────────

    private async executeExport(config: JobStrategyConfig): Promise<void> {
        const { source, context, exportDir } = config;
        const outputDir = exportDir ?? join(process.cwd(), 'exports');
        const outputFile = join(outputDir, `export-${context.jobId}.jsonl`);

        this.logger.log(`[${context.jobId}] EXPORT job — writing to ${outputFile}`);

        await mkdir(outputDir, { recursive: true });

        await source.initialize(context.sourceCredentials);

        const lines: string[] = [];
        let totalProcessed = 0;

        try {
            for await (const batch of source.extract()) {
                for (const item of batch) {
                    lines.push(JSON.stringify(item));
                    totalProcessed++;
                }

                // Flush to disk every 1000 items to keep memory bounded
                if (lines.length >= 1000) {
                    await writeFile(outputFile, lines.join('\n') + '\n', {
                        flag: lines.length === totalProcessed ? 'w' : 'a',
                        encoding: 'utf8',
                    });
                    lines.length = 0; // clear buffer

                    await this.jobRepository.updateProgress(context.jobId, totalProcessed, 0);
                    this.logger.log(`[${context.jobId}] EXPORT — ${totalProcessed} items written`);
                }
            }

            // Flush remaining
            if (lines.length > 0) {
                await writeFile(outputFile, lines.join('\n') + '\n', {
                    flag: 'a',
                    encoding: 'utf8',
                });
            }

            await this.jobRepository.updateProgress(context.jobId, totalProcessed, 0);
            await this.jobRepository.markCompleted(context.jobId);
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
