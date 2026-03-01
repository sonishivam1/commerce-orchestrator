import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';

export class ShopifySourceConnector implements SourceConnector<CanonicalProduct> {
    async initialize(credentials: Record<string, unknown>): Promise<void> {
        // TODO: Build Shopify GraphQL Admin API client
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalProduct[]> {
        // TODO: Use Shopify Admin GraphQL API — products query with pagination cursor
        yield [];
    }
}
