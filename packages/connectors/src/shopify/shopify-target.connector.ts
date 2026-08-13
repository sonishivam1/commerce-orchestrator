import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ErrorType } from '@cdo/shared';
import { canonicalToShopifyProductInput } from '@cdo/mapping';
import fetch from 'node-fetch';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const FIND_PRODUCT_BY_HANDLE = /* GraphQL */ `
    query FindProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
            id
        }
    }
`;

const PRODUCT_CREATE = /* GraphQL */ `
    mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
            product {
                id
                handle
            }
            userErrors {
                field
                message
            }
        }
    }
`;

const PRODUCT_UPDATE = /* GraphQL */ `
    mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
            product {
                id
                handle
            }
            userErrors {
                field
                message
            }
        }
    }
`;

// ─── Error Classification ─────────────────────────────────────────────────────

function classifyShopifyError(error: unknown): Error {
    const e = error as any;
    const status: number = e.statusCode ?? 0;
    const typed = new Error(e.message ?? String(error));

    if (e.type) {
        (typed as any).type = e.type;
    } else if (status === 429) {
        // Rate-limited — transient, back off and retry.
        (typed as any).type = ErrorType.TRANSIENT;
    } else if (status >= 400 && status < 500) {
        (typed as any).type = ErrorType.VALIDATION;
    } else {
        (typed as any).type = ErrorType.TRANSIENT;
    }

    return typed;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export class ShopifyTargetConnector implements TargetConnector<CanonicalProduct> {
    private shopUrl!: string;
    private accessToken!: string;
    /** Optional Shopify Location GID needed to set inventory quantities. */
    private locationId?: string;

    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken, locationId } = credentials;

        if (!shopName || !accessToken) {
            throw new Error('Missing required Shopify credentials (shopName, accessToken)');
        }

        this.shopUrl = `https://${shopName as string}.myshopify.com/admin/api/2024-01/graphql.json`;
        this.accessToken = accessToken as string;
        this.locationId = locationId as string | undefined;
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private async execute(query: string, variables: Record<string, unknown>): Promise<unknown> {
        const response = await fetch(this.shopUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            const body = await response.text();
            const err = new Error(`Shopify HTTP ${response.status}: ${body}`);
            (err as any).statusCode = response.status;
            throw err;
        }

        const json = (await response.json()) as { data?: unknown; errors?: Array<{ message: string }> };

        if (json.errors?.length) {
            throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
        }

        return json.data;
    }

    // ── Core upsert logic ─────────────────────────────────────────────────────

    /**
     * Upserts a single CanonicalProduct into a Shopify store.
     *
     * Strategy:
     * 1. Derive the Shopify handle from the canonical slug.
     * 2. Query `productByHandle` to detect whether the product already exists.
     * 3. Call `productCreate` or `productUpdate` accordingly.
     * 4. Surface any Shopify `userErrors` as VALIDATION errors.
     */
    private async upsertProduct(canonical: CanonicalProduct): Promise<void> {
        // Derive handle (first locale value of slug, fallback to key).
        const handle = Object.values(canonical.slug)[0] || canonical.key;

        // ── Check for existing product ────────────────────────────────────────
        const findData = (await this.execute(FIND_PRODUCT_BY_HANDLE, { handle })) as {
            productByHandle?: { id: string } | null;
        };

        const existingId = findData.productByHandle?.id;

        // ── Build input ───────────────────────────────────────────────────────
        const input = canonicalToShopifyProductInput(canonical, existingId, this.locationId);

        // ── Mutate ────────────────────────────────────────────────────────────
        const mutation = existingId ? PRODUCT_UPDATE : PRODUCT_CREATE;
        const operationKey = existingId ? 'productUpdate' : 'productCreate';

        const mutData = (await this.execute(mutation, { input })) as Record<
            string,
            { product: { id: string } | null; userErrors: Array<{ field: string[]; message: string }> }
        >;

        const result = mutData[operationKey];

        if (result.userErrors.length > 0) {
            const detail = result.userErrors
                .map(e => `[${e.field.join('.')}] ${e.message}`)
                .join('; ');
            const err = new Error(`Shopify validation errors for "${canonical.key}": ${detail}`);
            (err as any).type = ErrorType.VALIDATION;
            throw err;
        }
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const canonical of batch) {
            try {
                await this.upsertProduct(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                const classified = classifyShopifyError(error);
                results.push({
                    key: canonical.key,
                    success: false,
                    error: classified.message,
                });
            }
        }

        return results;
    }
}
