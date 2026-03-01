import type { CanonicalEntity } from '@cdo/shared';

export interface LoadResult {
    key: string;
    success: boolean;
    error?: string;
}

export interface TargetConnector<T extends CanonicalEntity> {
    initialize(credentials: Record<string, unknown>): Promise<void>;
    load(batch: T[]): Promise<LoadResult[]>;
    getCapabilities(): string[];
}
