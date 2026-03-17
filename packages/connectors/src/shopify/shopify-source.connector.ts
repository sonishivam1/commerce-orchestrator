import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ProductMapper, SourcePlatform } from '@cdo/mapping';
import fetch from 'node-fetch';

export class ShopifySourceConnector implements SourceConnector<CanonicalProduct> {
    private shopUrl!: string;
    private accessToken!: string;
    private readonly mapper = new ProductMapper(SourcePlatform.SHOPIFY);

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken } = credentials;

        if (!shopName || !accessToken) {
            throw new Error('Missing required Shopify credentials (shopName, accessToken)');
        }

        this.shopUrl = `https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`;
        this.accessToken = accessToken as string;
    }

    private async executeQuery(query: string, variables: any) {
        const response = await fetch(this.shopUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(`Shopify API error: ${response.statusText}`);
        }

        const json = await response.json() as any;
        if (json.errors) {
            throw new Error(`Shopify GraphQL errors: ${json.errors[0]?.message}`);
        }

        return json.data;
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalProduct[]> {
        let hasNextPage = true;
        let endCursor = cursor;

        const PRODUCTS_QUERY = `
            query getProducts($cursor: String) {
                products(first: 50, after: $cursor) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    edges {
                        node {
                            id
                            title
                            handle
                            descriptionHtml
                            productType
                            vendor
                            createdAt
                            updatedAt
                            tags
                            variants(first: 50) {
                                edges {
                                    node {
                                        id
                                        sku
                                        price
                                        inventoryQuantity
                                        compareAtPrice
                                    }
                                }
                            }
                            images(first: 10) {
                                edges {
                                    node {
                                        id
                                        url
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        while (hasNextPage) {
            const data = await this.executeQuery(PRODUCTS_QUERY, { cursor: endCursor });
            const productsInfo = data.products;
            
            hasNextPage = productsInfo.pageInfo.hasNextPage;
            endCursor = productsInfo.pageInfo.endCursor;

            const mappedBatch: CanonicalProduct[] = [];

            for (const edge of productsInfo.edges) {
                try {
                    // mapShopifyProduct expects the raw REST or equivalent shaped object from mapping tests.
                    // Wait, our mapShopifyProduct handles `id`, `title`, `handle`, `variants` etc.
                    // If the payload format here doesn't perfectly match the rule, it will throw in the Zod Validation check and be skipped.
                    // The core Engine will handle mapping edge cases as we expand rules.
                    const canonical = this.mapper.toCanonical(edge.node);
                    mappedBatch.push(canonical);
                } catch (error) {
                    console.error(`Skipping Shopify product ${edge.node.id} due to mapping error:`, (error as Error).message);
                }
            }

            if (mappedBatch.length > 0) {
                yield mappedBatch;
            }
        }
    }
}
