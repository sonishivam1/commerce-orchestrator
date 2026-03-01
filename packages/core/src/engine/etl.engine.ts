import type { CanonicalEntity } from '@cdo/shared';
import type { SourceConnector, TargetConnector, LoadResult } from '../interfaces/index';

export { LoadResult };

export interface EtlContext {
    tenantId: string;
    jobId: string;
    correlationId: string;
    lockToken?: string;
}

export interface EtlEngineOptions {
    batchSize?: number;
    maxRetries?: number;
}

type ProgressHandler = (results: LoadResult[]) => void;
type FailureHandler<T> = (error: Error, item: T) => void;

export class EtlEngine<T extends CanonicalEntity = CanonicalEntity> {
    private readonly batchSize: number;
    private readonly maxRetries: number;
    private progressHandler?: ProgressHandler;
    private failureHandler?: FailureHandler<T>;

    constructor(
        private readonly source: SourceConnector<T>,
        private readonly target: TargetConnector<T>,
        private readonly context: EtlContext,
        options: EtlEngineOptions = {},
    ) {
        this.batchSize = options.batchSize ?? 50;
        this.maxRetries = options.maxRetries ?? 3;
    }

    on(event: 'progress', handler: ProgressHandler): this;
    on(event: 'failure', handler: FailureHandler<T>): this;
    on(event: 'progress' | 'failure', handler: ProgressHandler | FailureHandler<T>): this {
        if (event === 'progress') {
            this.progressHandler = handler as ProgressHandler;
        } else {
            this.failureHandler = handler as FailureHandler<T>;
        }
        return this;
    }

    async run(): Promise<void> {
        await this.source.initialize({});
        await this.target.initialize({});

        for await (const batch of this.source.extract()) {
            try {
                const results: LoadResult[] = await this.target.load(batch);
                this.progressHandler?.(results);
            } catch (err) {
                for (const item of batch) {
                    this.failureHandler?.(err instanceof Error ? err : new Error(String(err)), item);
                }
            }
        }
    }
}
