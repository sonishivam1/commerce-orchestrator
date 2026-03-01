import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';

export class CommercetoolsTargetConnector implements TargetConnector<CanonicalProduct> {
    private credentials: Record<string, unknown> = {};

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        this.credentials = credentials;
        // TODO: Build CT import API client
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        // TODO: Map CanonicalProduct -> CT ProductDraft via @cdo/mapping
        // TODO: Upsert via CT Import API (idempotent by key)
        return batch.map(p => ({ key: p.key, success: true }));
    }

    getCapabilities(): string[] {
        return ['UPSERT_PRODUCT', 'UPSERT_CATEGORY', 'DEPLOY_SCHEMA', 'EXTRACT_SCHEMA'];
    }
}
