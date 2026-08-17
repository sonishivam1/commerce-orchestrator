import type { SourceConnector } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import { EntityType, ErrorType } from '@cdo/shared';
import { ProductMapper, CategoryMapper, CustomerMapper, SourcePlatform } from '@cdo/mapping';
import {
    createApiBuilderFromCtpClient,
    ByProjectKeyRequestBuilder,
} from '@commercetools/platform-sdk';
import { ClientBuilder, AuthMiddlewareOptions, HttpMiddlewareOptions } from '@commercetools/sdk-client-v2';
import fetch from 'node-fetch';

// Scopes required per entity type
const SCOPE_MAP: Record<EntityType, string[]> = {
    [EntityType.PRODUCTS]: ['view_products'],
    [EntityType.CATEGORIES]: ['view_categories'],
    [EntityType.CUSTOMERS]: ['view_customers'],
    [EntityType.ORDERS]: ['view_orders'],
};

export class CommercetoolsSourceConnector implements SourceConnector<CanonicalEntity> {
    private client!: ByProjectKeyRequestBuilder;
    private readonly productMapper = new ProductMapper(SourcePlatform.COMMERCETOOLS);
    private readonly categoryMapper = new CategoryMapper(SourcePlatform.COMMERCETOOLS);
    private readonly customerMapper = new CustomerMapper(SourcePlatform.COMMERCETOOLS);

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const {
            projectKey,
            clientId,
            clientSecret,
            authUrl = 'https://auth.europe-west1.gcp.commercetools.com',
            apiUrl = 'https://api.europe-west1.gcp.commercetools.com',
        } = credentials;

        if (!projectKey || !clientId || !clientSecret) {
            throw new Error('Missing required Commercetools credentials (projectKey, clientId, clientSecret)');
        }

        const scopes = SCOPE_MAP[this.entityType] ?? ['view_products'];
        const scopesWithProject = scopes.map(s => `${s}:${projectKey}`);

        const authMiddlewareOptions: AuthMiddlewareOptions = {
            host: authUrl as string,
            projectKey: projectKey as string,
            credentials: {
                clientId: clientId as string,
                clientSecret: clientSecret as string,
            },
            scopes: scopesWithProject,
            fetch,
        };

        const httpMiddlewareOptions: HttpMiddlewareOptions = {
            host: apiUrl as string,
            fetch,
        };

        const ctpClient = new ClientBuilder()
            .withProjectKey(projectKey as string)
            .withClientCredentialsFlow(authMiddlewareOptions)
            .withHttpMiddleware(httpMiddlewareOptions)
            .build();

        this.client = createApiBuilderFromCtpClient(ctpClient)
            .withProjectKey({ projectKey: projectKey as string });
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
                const err = new Error(`Unsupported entity type: ${this.entityType} for CommercetoolsSourceConnector`);
                (err as any).type = ErrorType.FATAL;
                throw err;
            }
        }
    }

    // ── Products ────────────────────────────────────────────────────────────────

    private async *extractProducts(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        let lastId = cursor;
        let hasMore = true;

        while (hasMore) {
            const response = await this.client.products().get({
                queryArgs: {
                    limit: 50,
                    sort: 'id asc',
                    where: lastId ? `id > "${lastId}"` : undefined,
                    withTotal: false,
                },
            }).execute();

            const results = response.body.results;

            if (results.length === 0) {
                hasMore = false;
                break;
            }

            const batch: CanonicalEntity[] = [];
            for (const item of results) {
                try {
                    batch.push(this.productMapper.toCanonical(item));
                } catch (error) {
                    // Individual mapping failures are VALIDATION errors — skip item, continue batch
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;

            lastId = results[results.length - 1].id;
        }
    }

    // ── Categories ──────────────────────────────────────────────────────────────

    private async *extractCategories(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        let lastId = cursor;
        let hasMore = true;

        while (hasMore) {
            const response = await this.client.categories().get({
                queryArgs: {
                    limit: 50,
                    sort: 'id asc',
                    where: lastId ? `id > "${lastId}"` : undefined,
                    withTotal: false,
                },
            }).execute();

            const results = response.body.results;

            if (results.length === 0) {
                hasMore = false;
                break;
            }

            const batch: CanonicalEntity[] = [];
            for (const item of results) {
                try {
                    batch.push(this.categoryMapper.toCanonical(item));
                } catch (error) {
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;

            lastId = results[results.length - 1].id;
        }
    }

    // ── Customers ───────────────────────────────────────────────────────────────

    private async *extractCustomers(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        let lastId = cursor;
        let hasMore = true;

        while (hasMore) {
            const response = await this.client.customers().get({
                queryArgs: {
                    limit: 50,
                    sort: 'id asc',
                    where: lastId ? `id > "${lastId}"` : undefined,
                    withTotal: false,
                },
            }).execute();

            const results = response.body.results;

            if (results.length === 0) {
                hasMore = false;
                break;
            }

            const batch: CanonicalEntity[] = [];
            for (const item of results) {
                try {
                    batch.push(this.customerMapper.toCanonical(item));
                } catch (error) {
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) yield batch;

            lastId = results[results.length - 1].id;
        }
    }

    // ── Orders ──────────────────────────────────────────────────────────────────

    private async *extractOrders(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        let lastId = cursor;
        let hasMore = true;

        while (hasMore) {
            const response = await this.client.orders().get({
                queryArgs: {
                    limit: 50,
                    sort: 'id asc',
                    where: lastId ? `id > "${lastId}"` : undefined,
                    withTotal: false,
                },
            }).execute();

            const results = response.body.results;

            if (results.length === 0) {
                hasMore = false;
                break;
            }

            // Orders are complex — yield the raw CT order structure wrapped in a minimal canonical envelope
            const batch: CanonicalEntity[] = results.map(order => ({
                _version: 'v1' as const,
                id: order.id,
                key: order.orderNumber ?? order.id,
                customerKey: order.customerId ?? order.customerEmail ?? '',
                lineItems: (order.lineItems ?? []).map((li: any) => ({
                    productKey: li.productKey ?? li.productId,
                    variantSku: li.variant?.sku ?? '',
                    quantity: li.quantity,
                    unitPrice: {
                        centAmount: li.price?.value?.centAmount ?? 0,
                        currencyCode: li.price?.value?.currencyCode ?? 'USD',
                        fractionDigits: li.price?.value?.fractionDigits ?? 2,
                    },
                })),
                totalPrice: {
                    centAmount: order.totalPrice?.centAmount ?? 0,
                    currencyCode: order.totalPrice?.currencyCode ?? 'USD',
                    fractionDigits: order.totalPrice?.fractionDigits ?? 2,
                },
                currency: order.totalPrice?.currencyCode ?? 'USD',
                status: mapCtOrderStatus(order.orderState),
            }));

            if (batch.length > 0) yield batch;

            lastId = results[results.length - 1].id;
        }
    }
}

function mapCtOrderStatus(state?: string): 'Open' | 'Confirmed' | 'Complete' | 'Cancelled' {
    switch (state) {
        case 'Open':       return 'Open';
        case 'Confirmed':  return 'Confirmed';
        case 'Complete':   return 'Complete';
        case 'Cancelled':  return 'Cancelled';
        default:           return 'Open';
    }
}
