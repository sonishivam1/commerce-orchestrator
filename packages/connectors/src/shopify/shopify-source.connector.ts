import type { SourceConnector } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import { EntityType, ErrorType } from '@cdo/shared';
import { ProductMapper, CategoryMapper, CustomerMapper, SourcePlatform } from '@cdo/mapping';
import fetch from 'node-fetch';

export class ShopifySourceConnector implements SourceConnector<CanonicalEntity> {
    private shopUrl!: string;
    private accessToken!: string;
    private readonly productMapper = new ProductMapper(SourcePlatform.SHOPIFY);
    private readonly categoryMapper = new CategoryMapper(SourcePlatform.SHOPIFY);
    private readonly customerMapper = new CustomerMapper(SourcePlatform.SHOPIFY);

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken } = credentials;

        if (!shopName || !accessToken) {
            throw new Error('Missing required Shopify credentials (shopName, accessToken)');
        }

        this.shopUrl = `https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`;
        this.accessToken = accessToken as string;
    }

    private async executeQuery(query: string, variables: Record<string, unknown>): Promise<Record<string, any>> {
        const response = await fetch(this.shopUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            const err = new Error(`Shopify API HTTP ${response.status}: ${response.statusText}`);
            (err as any).type = ErrorType.TRANSIENT;
            throw err;
        }

        const json = await response.json() as { data?: Record<string, any>; errors?: Array<{ message: string }> };
        if (json.errors?.length) {
            throw new Error(`Shopify GraphQL error: ${json.errors[0]?.message}`);
        }

        return json.data ?? {};
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        switch (this.entityType) {
            case EntityType.PRODUCTS:
                yield* this.extractProducts(cursor);
                break;
            case EntityType.CATEGORIES:
                yield* this.extractCategories(cursor);
                break;
            case EntityType.CUSTOMERS:
                yield* this.extractCustomers(cursor);
                break;
            case EntityType.ORDERS:
                yield* this.extractOrders(cursor);
                break;
            default: {
                const err = new Error(`Unsupported entity type: ${this.entityType} for ShopifySourceConnector`);
                (err as any).type = ErrorType.FATAL;
                throw err;
            }
        }
    }

    // ── Products ────────────────────────────────────────────────────────────────

    private async *extractProducts(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        const PRODUCTS_QUERY = `
            query getProducts($cursor: String) {
                products(first: 50, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id title handle descriptionHtml productType vendor
                            createdAt updatedAt tags
                            variants(first: 50) {
                                edges {
                                    node { id sku price inventoryQuantity compareAtPrice }
                                }
                            }
                            images(first: 10) {
                                edges { node { id url } }
                            }
                        }
                    }
                }
            }
        `;

        let endCursor: string | undefined = cursor;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await this.executeQuery(PRODUCTS_QUERY, { cursor: endCursor ?? null });
            const productsInfo = data.products;

            hasNextPage = productsInfo.pageInfo.hasNextPage;
            endCursor = productsInfo.pageInfo.endCursor;

            const batch: CanonicalEntity[] = [];
            for (const edge of productsInfo.edges) {
                try {
                    batch.push(this.productMapper.toCanonical(edge.node));
                } catch (error) {
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;
        }
    }

    // ── Categories (Collections) ─────────────────────────────────────────────────

    private async *extractCategories(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        const COLLECTIONS_QUERY = `
            query getCollections($cursor: String) {
                collections(first: 50, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id title handle
                        }
                    }
                }
            }
        `;

        let endCursor: string | undefined = cursor;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await this.executeQuery(COLLECTIONS_QUERY, { cursor: endCursor ?? null });
            const collectionsInfo = data.collections;

            hasNextPage = collectionsInfo.pageInfo.hasNextPage;
            endCursor = collectionsInfo.pageInfo.endCursor;

            const batch: CanonicalEntity[] = [];
            for (const edge of collectionsInfo.edges) {
                try {
                    batch.push(this.categoryMapper.toCanonical(edge.node));
                } catch (error) {
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;
        }
    }

    // ── Customers ───────────────────────────────────────────────────────────────

    private async *extractCustomers(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        const CUSTOMERS_QUERY = `
            query getCustomers($cursor: String) {
                customers(first: 50, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id email firstName lastName
                            defaultAddress {
                                address1 city zip country
                            }
                        }
                    }
                }
            }
        `;

        let endCursor: string | undefined = cursor;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await this.executeQuery(CUSTOMERS_QUERY, { cursor: endCursor ?? null });
            const customersInfo = data.customers;

            hasNextPage = customersInfo.pageInfo.hasNextPage;
            endCursor = customersInfo.pageInfo.endCursor;

            const batch: CanonicalEntity[] = [];
            for (const edge of customersInfo.edges) {
                try {
                    batch.push(this.customerMapper.toCanonical(edge.node));
                } catch (error) {
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;
        }
    }

    // ── Orders ──────────────────────────────────────────────────────────────────

    private async *extractOrders(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        const ORDERS_QUERY = `
            query getOrders($cursor: String) {
                orders(first: 50, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id name
                            customer { id email }
                            displayFinancialStatus
                            totalPriceSet {
                                shopMoney { amount currencyCode }
                            }
                            lineItems(first: 50) {
                                edges {
                                    node {
                                        title quantity
                                        sku
                                        originalUnitPriceSet {
                                            shopMoney { amount currencyCode }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        let endCursor: string | undefined = cursor;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await this.executeQuery(ORDERS_QUERY, { cursor: endCursor ?? null });
            const ordersInfo = data.orders;

            hasNextPage = ordersInfo.pageInfo.hasNextPage;
            endCursor = ordersInfo.pageInfo.endCursor;

            const batch: CanonicalEntity[] = ordersInfo.edges.map((edge: any) => {
                const o = edge.node;
                const totalAmount = parseFloat(o.totalPriceSet?.shopMoney?.amount ?? '0');
                const currency = o.totalPriceSet?.shopMoney?.currencyCode ?? 'USD';

                return {
                    _version: 'v1' as const,
                    id: o.id,
                    key: o.name ?? o.id,
                    customerKey: o.customer?.id ?? o.customer?.email ?? '',
                    lineItems: (o.lineItems?.edges ?? []).map((liEdge: any) => {
                        const li = liEdge.node;
                        const unitAmount = parseFloat(li.originalUnitPriceSet?.shopMoney?.amount ?? '0');
                        return {
                            productKey: li.title ?? '',
                            variantSku: li.sku ?? '',
                            quantity: li.quantity,
                            unitPrice: {
                                centAmount: Math.round(unitAmount * 100),
                                currencyCode: currency,
                                fractionDigits: 2,
                            },
                        };
                    }),
                    totalPrice: {
                        centAmount: Math.round(totalAmount * 100),
                        currencyCode: currency,
                        fractionDigits: 2,
                    },
                    currency,
                    status: mapShopifyOrderStatus(o.displayFinancialStatus),
                };
            });

            if (batch.length > 0) yield batch;
        }
    }
}

function mapShopifyOrderStatus(status?: string): 'Open' | 'Confirmed' | 'Complete' | 'Cancelled' {
    switch (status) {
        case 'PAID':
        case 'PARTIALLY_PAID':
            return 'Confirmed';
        case 'REFUNDED':
        case 'VOIDED':
            return 'Cancelled';
        case 'PENDING':
            return 'Open';
        default:
            return 'Open';
    }
}
