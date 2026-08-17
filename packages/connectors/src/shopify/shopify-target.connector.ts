import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalEntity, CanonicalProduct, CanonicalCategory, CanonicalCustomer } from '@cdo/shared';
import { EntityType, ErrorType } from '@cdo/shared';
import {
    canonicalToShopifyProductInput,
    canonicalToShopifyCategoryInput,
    canonicalToShopifyCustomerInput,
} from '@cdo/mapping';
import fetch from 'node-fetch';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const FIND_PRODUCT_BY_HANDLE = /* GraphQL */ `
    query FindProductByHandle($handle: String!) {
        productByHandle(handle: $handle) { id }
    }
`;

const PRODUCT_CREATE = /* GraphQL */ `
    mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
            product { id handle }
            userErrors { field message }
        }
    }
`;

const PRODUCT_UPDATE = /* GraphQL */ `
    mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
            product { id handle }
            userErrors { field message }
        }
    }
`;

const FIND_COLLECTION_BY_HANDLE = /* GraphQL */ `
    query FindCollectionByHandle($handle: String!) {
        collectionByHandle(handle: $handle) { id }
    }
`;

const COLLECTION_CREATE = /* GraphQL */ `
    mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(collection: $input) {
            collection { id handle }
            userErrors { field message }
        }
    }
`;

const COLLECTION_UPDATE = /* GraphQL */ `
    mutation CollectionUpdate($input: CollectionInput!) {
        collectionUpdate(collection: $input) {
            collection { id handle }
            userErrors { field message }
        }
    }
`;

const FIND_CUSTOMER_BY_EMAIL = /* GraphQL */ `
    query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
            edges { node { id email } }
        }
    }
`;

const CUSTOMER_CREATE = /* GraphQL */ `
    mutation CustomerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
            customer { id email }
            userErrors { field message }
        }
    }
`;

const CUSTOMER_UPDATE = /* GraphQL */ `
    mutation CustomerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
            customer { id email }
            userErrors { field message }
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
        (typed as any).type = ErrorType.TRANSIENT;
    } else if (status >= 400 && status < 500) {
        (typed as any).type = ErrorType.VALIDATION;
    } else {
        (typed as any).type = ErrorType.TRANSIENT;
    }

    return typed;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export class ShopifyTargetConnector implements TargetConnector<CanonicalEntity> {
    private shopUrl!: string;
    private accessToken!: string;
    /** Optional Shopify Location GID needed to set inventory quantities. */
    private locationId?: string;

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

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

    private assertNoUserErrors(result: { userErrors: Array<{ field: string[]; message: string }> }, itemKey: string): void {
        if (result.userErrors.length > 0) {
            const detail = result.userErrors.map(e => `[${e.field.join('.')}] ${e.message}`).join('; ');
            const err = new Error(`Shopify validation errors for "${itemKey}": ${detail}`);
            (err as any).type = ErrorType.VALIDATION;
            throw err;
        }
    }

    async load(batch: CanonicalEntity[]): Promise<LoadResult[]> {
        switch (this.entityType) {
            case EntityType.PRODUCTS:
                return this.loadProducts(batch as CanonicalProduct[]);
            case EntityType.CATEGORIES:
                return this.loadCategories(batch as CanonicalCategory[]);
            case EntityType.CUSTOMERS:
                return this.loadCustomers(batch as CanonicalCustomer[]);
            default: {
                const err = new Error(`Unsupported entity type for Shopify target: ${this.entityType}`);
                (err as any).type = ErrorType.VALIDATION;
                throw err;
            }
        }
    }

    // ── Products ──────────────────────────────────────────────────────────────

    private async upsertProduct(canonical: CanonicalProduct): Promise<void> {
        const handle = Object.values(canonical.slug)[0] || canonical.key;

        const findData = (await this.execute(FIND_PRODUCT_BY_HANDLE, { handle })) as {
            productByHandle?: { id: string } | null;
        };

        const existingId = findData.productByHandle?.id;
        const input = canonicalToShopifyProductInput(canonical, existingId, this.locationId);

        const mutation = existingId ? PRODUCT_UPDATE : PRODUCT_CREATE;
        const operationKey = existingId ? 'productUpdate' : 'productCreate';

        const mutData = (await this.execute(mutation, { input })) as Record<
            string,
            { product: { id: string } | null; userErrors: Array<{ field: string[]; message: string }> }
        >;

        this.assertNoUserErrors(mutData[operationKey], canonical.key);
    }

    private async loadProducts(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertProduct(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                results.push({ key: canonical.key, success: false, error: classifyShopifyError(error).message });
            }
        }
        return results;
    }

    // ── Categories (Collections) ──────────────────────────────────────────────

    private async upsertCategory(canonical: CanonicalCategory): Promise<void> {
        const input = canonicalToShopifyCategoryInput(canonical);
        const handle = (input.handle as string) || canonical.key;

        const findData = (await this.execute(FIND_COLLECTION_BY_HANDLE, { handle })) as {
            collectionByHandle?: { id: string } | null;
        };

        const existingId = findData.collectionByHandle?.id;

        if (existingId) {
            const mutData = (await this.execute(COLLECTION_UPDATE, { input: { ...input, id: existingId } })) as any;
            this.assertNoUserErrors(mutData.collectionUpdate, canonical.key);
        } else {
            const mutData = (await this.execute(COLLECTION_CREATE, { input })) as any;
            this.assertNoUserErrors(mutData.collectionCreate, canonical.key);
        }
    }

    private async loadCategories(batch: CanonicalCategory[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertCategory(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                results.push({ key: canonical.key, success: false, error: classifyShopifyError(error).message });
            }
        }
        return results;
    }

    // ── Customers ─────────────────────────────────────────────────────────────

    private async upsertCustomer(canonical: CanonicalCustomer): Promise<void> {
        // Look up existing customer by email (Shopify's natural key for customers)
        const findData = (await this.execute(FIND_CUSTOMER_BY_EMAIL, {
            query: `email:${canonical.email}`,
        })) as { customers: { edges: Array<{ node: { id: string; email: string } }> } };

        const existingId = findData.customers.edges[0]?.node?.id;
        const input = canonicalToShopifyCustomerInput(canonical, existingId);

        if (existingId) {
            const mutData = (await this.execute(CUSTOMER_UPDATE, { input })) as any;
            this.assertNoUserErrors(mutData.customerUpdate, canonical.key);
        } else {
            const mutData = (await this.execute(CUSTOMER_CREATE, { input })) as any;
            this.assertNoUserErrors(mutData.customerCreate, canonical.key);
        }
    }

    private async loadCustomers(batch: CanonicalCustomer[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertCustomer(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                results.push({ key: canonical.key, success: false, error: classifyShopifyError(error).message });
            }
        }
        return results;
    }
}
