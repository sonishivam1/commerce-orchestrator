import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';

export class ShopifyTargetConnector implements TargetConnector<CanonicalProduct> {
    async initialize(credentials: Record<string, unknown>): Promise<void> {
        // TODO: Build Shopify GraphQL Admin API client
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        // TODO: Map CanonicalProduct -> Shopify productCreate/productUpdate mutation
        // TODO: Execute via GraphQL Admin API
        return batch.map(p => ({ key: p.key, success: true }));
    }

    getCapabilities(): string[] {
        return ['UPSERT_PRODUCT'];
    }
}
