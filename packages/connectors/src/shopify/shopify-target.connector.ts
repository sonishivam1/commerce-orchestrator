import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalEntity, CanonicalProduct, CanonicalCategory, CanonicalCustomer, CanonicalOrder } from '@cdo/shared';
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

// NOTE: Shopify Admin API uses `input:` (not `collection:`) for collection mutations.
const COLLECTION_CREATE = /* GraphQL */ `
    mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
            collection { id handle }
            userErrors { field message }
        }
    }
`;

const COLLECTION_UPDATE = /* GraphQL */ `
    mutation CollectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
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

const DRAFT_ORDER_CREATE = /* GraphQL */ `
    mutation DraftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
            draftOrder { id name }
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
    /**
     * Resolved identity maps injected by the wave executor via credentials.__identityMaps.
     * Key: EntityType string (e.g. 'CATEGORIES').
     * Value: Record of sourceKey → targetId (e.g. 'ct-electronics' → 'gid://shopify/Collection/123').
     */
    private identityMaps: Record<string, Record<string, string>> = {};

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken, locationId, __identityMaps } = credentials;

        if (!shopName || !accessToken) {
            throw new Error('Missing required Shopify credentials (shopName, accessToken)');
        }

        this.shopUrl = `https://${shopName as string}.myshopify.com/admin/api/2024-01/graphql.json`;
        this.accessToken = accessToken as string;
        this.locationId = locationId as string | undefined;
        this.identityMaps = (__identityMaps as Record<string, Record<string, string>>) ?? {};
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

    private assertNoUserErrors(
        result: { userErrors: Array<{ field: string[]; message: string }> },
        itemKey: string,
    ): void {
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
            case EntityType.ORDERS:
                return this.loadOrders(batch as CanonicalOrder[]);
            default: {
                const err = new Error(`Unsupported entity type for Shopify target: ${this.entityType}`);
                (err as any).type = ErrorType.VALIDATION;
                throw err;
            }
        }
    }

    // ── Categories (Collections) ──────────────────────────────────────────────

    private async upsertCategory(canonical: CanonicalCategory): Promise<string> {
        const input = canonicalToShopifyCategoryInput(canonical);
        const handle = (input.handle as string) || canonical.key;

        const findData = (await this.execute(FIND_COLLECTION_BY_HANDLE, { handle })) as {
            collectionByHandle?: { id: string } | null;
        };

        const existingId = findData.collectionByHandle?.id;

        if (existingId) {
            const mutData = (await this.execute(COLLECTION_UPDATE, { input: { ...input, id: existingId } })) as any;
            this.assertNoUserErrors(mutData.collectionUpdate, canonical.key);
            return mutData.collectionUpdate.collection?.id ?? existingId;
        } else {
            const mutData = (await this.execute(COLLECTION_CREATE, { input })) as any;
            this.assertNoUserErrors(mutData.collectionCreate, canonical.key);
            return mutData.collectionCreate.collection!.id;
        }
    }

    private async loadCategories(batch: CanonicalCategory[]): Promise<LoadResult[]> {
        return Promise.all(
            batch.map(async (canonical) => {
                try {
                    const targetId = await this.upsertCategory(canonical);
                    return { key: canonical.key, success: true, targetId };
                } catch (error: unknown) {
                    return { key: canonical.key, success: false, error: classifyShopifyError(error).message };
                }
            }),
        );
    }

    // ── Products ──────────────────────────────────────────────────────────────

    private async upsertProduct(canonical: CanonicalProduct): Promise<string> {
        const handle = Object.values(canonical.slug)[0] || canonical.key;

        const findData = (await this.execute(FIND_PRODUCT_BY_HANDLE, { handle })) as {
            productByHandle?: { id: string } | null;
        };

        const existingId = findData.productByHandle?.id;

        // Resolve canonical categoryKeys → Shopify collection GIDs via identity maps
        const categoryMap = this.identityMaps[EntityType.CATEGORIES] ?? {};
        const collectionsToJoin = canonical.categoryKeys
            .map((key) => categoryMap[key])
            .filter(Boolean) as string[];

        const input = canonicalToShopifyProductInput(canonical, existingId, this.locationId);

        // Inject resolved collection GIDs into the ProductInput when available
        if (collectionsToJoin.length > 0) {
            (input as Record<string, unknown>).collectionsToJoin = collectionsToJoin;
        }

        const mutation = existingId ? PRODUCT_UPDATE : PRODUCT_CREATE;
        const operationKey = existingId ? 'productUpdate' : 'productCreate';

        const mutData = (await this.execute(mutation, { input })) as Record<
            string,
            { product: { id: string } | null; userErrors: Array<{ field: string[]; message: string }> }
        >;

        this.assertNoUserErrors(mutData[operationKey], canonical.key);
        return mutData[operationKey].product!.id;
    }

    private async loadProducts(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        return Promise.all(
            batch.map(async (canonical) => {
                try {
                    const targetId = await this.upsertProduct(canonical);
                    return { key: canonical.key, success: true, targetId };
                } catch (error: unknown) {
                    return { key: canonical.key, success: false, error: classifyShopifyError(error).message };
                }
            }),
        );
    }

    // ── Customers ─────────────────────────────────────────────────────────────

    private async upsertCustomer(canonical: CanonicalCustomer): Promise<string> {
        // Look up existing customer by email (Shopify's natural key for customers)
        const findData = (await this.execute(FIND_CUSTOMER_BY_EMAIL, {
            query: `email:${canonical.email}`,
        })) as { customers: { edges: Array<{ node: { id: string; email: string } }> } };

        const existingId = findData.customers.edges[0]?.node?.id;
        const input = canonicalToShopifyCustomerInput(canonical, existingId);

        if (existingId) {
            const mutData = (await this.execute(CUSTOMER_UPDATE, { input })) as any;
            this.assertNoUserErrors(mutData.customerUpdate, canonical.key);
            return mutData.customerUpdate.customer?.id ?? existingId;
        } else {
            const mutData = (await this.execute(CUSTOMER_CREATE, { input })) as any;
            this.assertNoUserErrors(mutData.customerCreate, canonical.key);
            return mutData.customerCreate.customer!.id;
        }
    }

    private async loadCustomers(batch: CanonicalCustomer[]): Promise<LoadResult[]> {
        return Promise.all(
            batch.map(async (canonical) => {
                try {
                    const targetId = await this.upsertCustomer(canonical);
                    return { key: canonical.key, success: true, targetId };
                } catch (error: unknown) {
                    return { key: canonical.key, success: false, error: classifyShopifyError(error).message };
                }
            }),
        );
    }

    // ── Orders (Draft Orders) ─────────────────────────────────────────────────

    private async upsertOrder(canonical: CanonicalOrder): Promise<string> {
        const customerMap = this.identityMaps[EntityType.CUSTOMERS] ?? {};
        const customerId = canonical.customerKey
            ? customerMap[canonical.customerKey]
            : undefined;

        // Map line items as custom line items (no Shopify variantId available at this stage)
        const lineItems = canonical.lineItems.map((li) => ({
            title: li.variantSku ?? li.productKey ?? 'Unknown Item',
            quantity: li.quantity,
            originalUnitPrice: (
                li.unitPrice.centAmount / Math.pow(10, li.unitPrice.fractionDigits)
            ).toFixed(li.unitPrice.fractionDigits),
        }));

        const input: Record<string, unknown> = {
            lineItems,
            currency: canonical.currency,
            note: `Migrated from source order: ${canonical.key}`,
            tags: [`source-key:${canonical.key}`],
        };

        if (customerId) input['customerId'] = customerId;

        const mutData = (await this.execute(DRAFT_ORDER_CREATE, { input })) as any;
        this.assertNoUserErrors(mutData.draftOrderCreate, canonical.key);
        return mutData.draftOrderCreate.draftOrder!.id;
    }

    private async loadOrders(batch: CanonicalOrder[]): Promise<LoadResult[]> {
        return Promise.all(
            batch.map(async (canonical) => {
                try {
                    const targetId = await this.upsertOrder(canonical);
                    return { key: canonical.key, success: true, targetId };
                } catch (error: unknown) {
                    return { key: canonical.key, success: false, error: classifyShopifyError(error).message };
                }
            }),
        );
    }
}
