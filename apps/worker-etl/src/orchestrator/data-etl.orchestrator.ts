import { Injectable } from '@nestjs/common';
import { EtlEngine, type EtlContext } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import type { SourceConnector, TargetConnector } from '@cdo/core';

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
    async execute(config: JobStrategyConfig): Promise<void> {
        const { source, target, context } = config;

        const engine = new EtlEngine(source, target, context);

        engine.on('progress', (results) => {
            const ok = results.filter((r) => r.success).length;
            const fail = results.filter((r) => !r.success).length;
            console.log(`[Orchestrator] Job ${context.jobId} — +${ok} ok, +${fail} failed`);
            // TODO: Call JobRepository.updateProgress(context.jobId, ok, fail)
        });

        engine.on('failure', (error, _item) => {
            console.error(`[Orchestrator] Job ${context.jobId} — item failed:`, error.message);
            // TODO: Push failed item to DLQ in MongoDB
        });

        await engine.run();
    }
}
