import { Injectable, Logger } from '@nestjs/common';
import { EtlEngine, type EtlContext } from '@cdo/core';
import { ErrorType, type CanonicalEntity } from '@cdo/shared';
import type { SourceConnector, TargetConnector } from '@cdo/core';
import { JobRepository, DlqRepository } from '@cdo/db';

export interface JobStrategyConfig {
    jobKind: string;
    source: SourceConnector;
    target: TargetConnector<CanonicalEntity>;
    context: EtlContext;
}

/**
 * DataEtlOrchestrator — the bridge between Worker infrastructure and the Core Engine.
 *
 * The Orchestrator injects:
 * - tenantId (safe state resolution)
 * - correlationId (observability tracing)
 * - lockToken (Redlock persistence marker)
 * - jobType strategy (Scrape vs Migration)
 */
@Injectable()
export class DataEtlOrchestrator {
    private readonly logger = new Logger(DataEtlOrchestrator.name);

    constructor(
        private readonly jobRepository: JobRepository,
        private readonly dlqRepository: DlqRepository
    ) {}

    async execute(config: JobStrategyConfig): Promise<void> {
        const { source, target, context } = config;

        const engine = new EtlEngine(source, target, context);

        let totalProcessed = 0;
        let totalFailed = 0;

        engine.on('progress', async (results) => {
            const ok = results.filter((r) => r.success).length;
            const fail = results.filter((r) => !r.success).length;
            totalProcessed += ok + fail;
            totalFailed += fail;

            this.logger.log(`Job ${context.jobId} — +${ok} succeeded, +${fail} failed`);
            
            // Fire-and-forget progress update to not block pipeline stream mapping
            this.jobRepository.updateProgress(context.jobId, totalProcessed, totalFailed).catch(e => {
                this.logger.error(`Failed to update job progress MongoDB: ${e.message}`);
            });
        });

        engine.on('failure', async (error: any, item: CanonicalEntity | undefined) => {
            this.logger.error(`Job ${context.jobId} — item failed: ${error.message}`);
            
            if (item) {
                try {
                    await this.dlqRepository.create({
                        tenantId: context.tenantId,
                        jobId: context.jobId,
                        itemKey: item.key || 'unknown',
                        errorType: error.type || ErrorType.FATAL,
                        errorMessage: error.message,
                        rawPayload: item as unknown as Record<string, unknown>,
                        canReplay: error.type !== ErrorType.VALIDATION // Validation errors require manual intervention, skip infinite loops
                    });
                } catch (dlqErr) {
                    this.logger.error(`Failed to push failed item to DLQ MongoDB for ${item.key}: ${(dlqErr as Error).message}`);
                }
            }
        });

        try {
            await engine.run();
            await this.jobRepository.markCompleted(context.jobId);
        } catch (error) {
            await this.jobRepository.markFailed(context.jobId, { 
                message: (error as Error).message, 
                stack: (error as Error).stack 
            });
            throw error;
        }
    }
}
