import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';

export class ShopifyTargetConnector implements TargetConnector<CanonicalProduct> {
    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken } = credentials;

        if (!shopName || !accessToken) {
            throw new Error('Missing required Shopify credentials');
        }
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const item of batch) {
            try {
                // TODO: Reverse mapping via @cdo/mapping ProductMapper.fromCanonical()
                // Construct standard Shopify GraphQL ProductCreateInput / ProductUpdateInput
                throw new Error('Shopify Target Mutation not fully implemented');
            } catch (error) {
                results.push({
                    key: item.key,
                    success: false,
                    error: (error as Error).message,
                });
            }
        }

        return results;
    }
}
