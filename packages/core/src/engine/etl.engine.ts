import { CanonicalEntity, ErrorType, DEFAULT_BATCH_SIZE, MAX_JOB_RETRIES } from '@cdo/shared';
import type { SourceConnector, TargetConnector, LoadResult } from '../interfaces/index';
import { CircuitBreaker } from './circuit-breaker';
import { withRetry } from './retry';

export { LoadResult };

export interface EtlContext {
    tenantId: string;
    jobId: string;
    correlationId: string;
    lockToken?: string;
    /** Decrypted credentials for the source platform — injected by the Worker orchestrator */
    sourceCredentials: Record<string, unknown>;
    /** Decrypted credentials for the target platform — injected by the Worker orchestrator */
    targetCredentials: Record<string, unknown>;
}

export interface EtlEngineOptions {
    batchSize?: number;
    maxRetries?: number;
    circuitBreaker?: (error: Error) => void;
}

type ProgressHandler = (results: LoadResult[]) => void;
type FailureHandler<T> = (error: Error, item?: T) => void;
type CompleteHandler = () => void;

interface JobError extends Error {
    type?: ErrorType;
}

export class EtlEngine<T extends CanonicalEntity = CanonicalEntity> {
    private readonly batchSize: number;
    private readonly maxRetries: number;
    private readonly circuitBreakerCallback?: (error: Error) => void;

    private progressHandler?: ProgressHandler;
    private failureHandler?: FailureHandler<T>;
    private completeHandler?: CompleteHandler;

    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        private readonly source: SourceConnector<T>,
        private readonly target: TargetConnector<T>,
        private readonly context: EtlContext,
        options: EtlEngineOptions = {},
    ) {
        this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
        this.maxRetries = options.maxRetries ?? MAX_JOB_RETRIES;
        this.circuitBreakerCallback = options.circuitBreaker;
        this.circuitBreaker = new CircuitBreaker();
    }

    on(event: 'progress', handler: ProgressHandler): this;
    on(event: 'failure', handler: FailureHandler<T>): this;
    on(event: 'complete', handler: CompleteHandler): this;
    on(event: 'progress' | 'failure' | 'complete', handler: any): this {
        if (event === 'progress') this.progressHandler = handler;
        if (event === 'failure') this.failureHandler = handler;
        if (event === 'complete') this.completeHandler = handler;
        return this;
    }

    async run(): Promise<void> {
        // Credentials flow in from the Worker orchestrator via EtlContext — never hardcoded
        await this.source.initialize(this.context.sourceCredentials);
        await this.target.initialize(this.context.targetCredentials);

        let currentBatch: T[] = [];

        try {
            for await (const sourceBatch of this.source.extract()) {
                for (const item of sourceBatch) {
                    currentBatch.push(item);

                    if (currentBatch.length >= this.batchSize) {
                        await this.processBatch(currentBatch);
                        currentBatch = [];
                    }
                }
            }

            if (currentBatch.length > 0) {
                await this.processBatch(currentBatch);
            }

            this.completeHandler?.();
        } catch (error: any) {
            this.handleFatalError(error);
        }
    }

    private async processBatch(batch: T[]): Promise<void> {
        this.circuitBreaker.check();

        let targetResults: LoadResult[] = [];

        try {
            targetResults = await withRetry(
                () => this.target.load(batch),
                { maxRetries: this.maxRetries }
            );
            this.circuitBreaker.recordSuccess();
        } catch (error: any) {
            const errType = (error as JobError).type;
            
            if (errType === ErrorType.FATAL) {
                this.handleFatalError(error);
                return;
            }

            this.circuitBreaker.recordFailure(errType);

            // If the whole batch fails consistently, fallback to item-by-item processing
            // to isolate bad items (like a single Validation error failing the entire batch request)
            targetResults = await this.recoverBatchItemByItem(batch);
        }

        this.processTargetResults(batch, targetResults);
    }

    private async recoverBatchItemByItem(batch: T[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const item of batch) {
            try {
                this.circuitBreaker.check();
                const individualResults = await withRetry(
                    () => this.target.load([item]),
                    { maxRetries: this.maxRetries }
                );
                
                if (individualResults.length > 0) {
                    results.push(individualResults[0]);
                }
                this.circuitBreaker.recordSuccess();

            } catch (error: any) {
                const errType = (error as JobError).type;
                if (errType === ErrorType.FATAL) {
                    this.handleFatalError(error);
                    break;
                }
                
                this.circuitBreaker.recordFailure(errType);

                // Emulate a failed LoadResult for this isolated item
                results.push({
                    key: item.key,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return results;
    }

    private processTargetResults(batch: T[], results: LoadResult[]): void {
        const successfulResults: LoadResult[] = [];

        for (const item of batch) {
            const result = results.find(r => r.key === item.key);

            if (!result) {
                const err = new Error(`No load result returned for key: ${item.key}`);
                (err as JobError).type = ErrorType.FATAL;
                this.failureHandler?.(err, item);
                continue;
            }

            if (result.success) {
                successfulResults.push(result);
            } else {
                const err = new Error(result.error ?? 'Unknown target error');
                (err as JobError).type = ErrorType.TRANSIENT; // Default fallback type for individual failure
                
                if (result.error?.toLowerCase().includes('validation')) {
                    (err as JobError).type = ErrorType.VALIDATION;
                }
                
                this.failureHandler?.(err, item);
            }
        }

        if (successfulResults.length > 0) {
            this.progressHandler?.(successfulResults);
        }
    }

    private handleFatalError(error: Error): void {
        (error as JobError).type = ErrorType.FATAL;
        this.circuitBreaker.trip();
        if (this.circuitBreakerCallback) {
            this.circuitBreakerCallback(error);
        } else {
            this.failureHandler?.(error);
            // Re-throw fatal errors to stop pipeline execution entirely
            throw error;
        }
    }
}
