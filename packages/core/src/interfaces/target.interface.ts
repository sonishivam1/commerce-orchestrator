export interface LoadResult {
    lastCursor?: string;
    successCount: number;
    failureCount: number;
    failures: Array<{
        payload: any;
        error: any;
    }>;
}

export interface TargetConnector<TCanonical> {
    initialize(credentials: Record<string, any>): Promise<void>;
    load(batch: TCanonical[]): Promise<LoadResult>;
}
