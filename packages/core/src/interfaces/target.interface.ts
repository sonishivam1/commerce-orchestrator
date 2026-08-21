import type { CanonicalEntity } from '@cdo/shared';

export interface LoadResult {
    key: string;
    success: boolean;
    error?: string;
    /**
     * The ID assigned by the target platform after a successful create or update.
     * Set by target connectors so the orchestrator can write an IdentityMap entry.
     * Undefined for failures or when the connector does not yet return target IDs.
     */
    targetId?: string;
}

export interface TargetConnector<T extends CanonicalEntity> {
    initialize(credentials: Record<string, unknown>): Promise<void>;
    load(batch: T[]): Promise<LoadResult[]>;
    getCapabilities(): string[];
}
