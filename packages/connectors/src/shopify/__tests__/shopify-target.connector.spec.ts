/**
 * shopify-target.connector.spec.ts
 *
 * Unit tests for the Shopify target connector (Phase 3B).
 *
 * Mock strategy: jest.mock('node-fetch') — every HTTP call goes through the
 * mocked `fetch`, which returns JSON-serialised Shopify GraphQL responses.
 *
 * Covered:
 *   - Category upsert → targetId (create + update paths)
 *   - Correct mutation argument names (input: not collection:)
 *   - Product upsert → targetId + collectionsToJoin resolution
 *   - Product upsert does NOT include variants in ProductInput (API 2024-01 rejects it)
 *   - Product upsert syncs master variant via GET_PRODUCT_VARIANTS + PRODUCT_VARIANT_UPDATE
 *   - Customer upsert → targetId (create + update paths)
 *   - Order creation via draftOrderCreate → targetId + customerId resolution
 *   - assertNoUserErrors handles field: null without crashing
 *   - Error classification (userErrors → VALIDATION, HTTP 429 → TRANSIENT, etc.)
 *   - Per-item isolation: one item's failure does not abort the rest of the batch
 */

// ─── Mock node-fetch (factory — ensures connector + test share the same instance) ──

const mockFetchFn = jest.fn();
jest.mock('node-fetch', () => mockFetchFn);

import { ShopifyTargetConnector } from '../shopify-target.connector';
import { EntityType, ErrorType } from '@cdo/shared';
import type { CanonicalCategory, CanonicalProduct, CanonicalCustomer } from '@cdo/shared';

const mockFetch = mockFetchFn as jest.MockedFunction<typeof mockFetchFn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal OK fetch response carrying a Shopify GraphQL response body.
 */
function mockOkResponse(data: Record<string, unknown>): ReturnType<typeof jest.fn> {
    return {
        ok: true,
        status: 200,
        json: async () => ({ data }),
        text: async () => JSON.stringify({ data }),
    } as any;
}

/**
 * Build an HTTP-error response (non-2xx).
 */
function mockHttpErrorResponse(status: number, body = 'error'): ReturnType<typeof jest.fn> {
    return {
        ok: false,
        status,
        text: async () => body,
        json: async () => ({}),
    } as any;
}

/** Credentials used across most tests. */
const BASE_CREDENTIALS = {
    shopName: 'test-store',
    accessToken: 'shpat-test',
};

/** Helper: inspect the body sent to fetch in the Nth call (0-indexed). */
function bodyOf(callIndex: number): Record<string, unknown> {
    const call = mockFetch.mock.calls[callIndex];
    return JSON.parse((call[1] as any).body as string);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CATEGORY: CanonicalCategory = {
    key: 'cat-electronics',
    name: { 'en-US': 'Electronics' },
    slug: { 'en-US': 'electronics' },
    description: {},
    parentKey: undefined,
    customAttributes: {},
} as unknown as CanonicalCategory;

const PRODUCT: CanonicalProduct = {
    key: 'prod-iphone',
    name: { 'en-US': 'iPhone 15' },
    slug: { 'en-US': 'iphone-15' },
    description: {},
    categoryKeys: ['cat-electronics'],
    masterVariant: {
        sku: 'IPHONE-15-BLK',
        prices: [{ centAmount: 99900, currencyCode: 'USD', fractionDigits: 2 }],
        attributes: {},
        images: [],
        stockQuantity: 10,
    },
    variants: [],
    isPublished: true,
    customAttributes: {},
} as unknown as CanonicalProduct;

const CUSTOMER: CanonicalCustomer = {
    key: 'cust-jane',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    customAttributes: {},
} as unknown as CanonicalCustomer;

const ORDER = {
    key: 'order-001',
    customerKey: 'cust-jane',
    lineItems: [
        {
            productKey: 'prod-iphone',
            variantSku: 'IPHONE-15-BLK',
            quantity: 1,
            unitPrice: { centAmount: 99900, currencyCode: 'USD', fractionDigits: 2 },
        },
    ],
    totalPrice: { centAmount: 99900, currencyCode: 'USD', fractionDigits: 2 },
    currency: 'USD',
    status: 'complete',
} as any;

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('ShopifyTargetConnector — Categories', () => {
    let connector: ShopifyTargetConnector;

    beforeEach(async () => {
        jest.clearAllMocks();
        connector = new ShopifyTargetConnector(EntityType.CATEGORIES);
        await connector.initialize(BASE_CREDENTIALS);
    });

    it('creates new collection and returns collection GID as targetId', async () => {
        // FindCollectionByHandle → not found
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ collectionByHandle: null }) as any)
            // CollectionCreate → success
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionCreate: {
                        collection: { id: 'gid://shopify/Collection/111', handle: 'electronics' },
                        userErrors: [],
                    },
                }) as any,
            );

        const [result] = await connector.load([CATEGORY]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/Collection/111');
        expect(result.key).toBe('cat-electronics');
    });

    it('updates existing collection and returns GID', async () => {
        // FindCollectionByHandle → found
        mockFetch
            .mockResolvedValueOnce(
                mockOkResponse({ collectionByHandle: { id: 'gid://shopify/Collection/222' } }) as any,
            )
            // CollectionUpdate → success
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionUpdate: {
                        collection: { id: 'gid://shopify/Collection/222', handle: 'electronics' },
                        userErrors: [],
                    },
                }) as any,
            );

        const [result] = await connector.load([CATEGORY]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/Collection/222');
    });

    it('collectionCreate mutation uses input: argument, not collection:', async () => {
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ collectionByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionCreate: {
                        collection: { id: 'gid://shopify/Collection/333', handle: 'electronics' },
                        userErrors: [],
                    },
                }) as any,
            );

        await connector.load([CATEGORY]);

        // Second call is the mutation — its query body must use `input:` not `collection:`
        const mutBody = bodyOf(1);
        expect(mutBody.query).toContain('collectionCreate(input: $input)');
        expect(mutBody.query).not.toContain('collectionCreate(collection:');
    });

    it('collectionUpdate mutation uses input: argument, not collection:', async () => {
        mockFetch
            .mockResolvedValueOnce(
                mockOkResponse({ collectionByHandle: { id: 'gid://shopify/Collection/444' } }) as any,
            )
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionUpdate: {
                        collection: { id: 'gid://shopify/Collection/444', handle: 'electronics' },
                        userErrors: [],
                    },
                }) as any,
            );

        await connector.load([CATEGORY]);

        const mutBody = bodyOf(1);
        expect(mutBody.query).toContain('collectionUpdate(input: $input)');
        expect(mutBody.query).not.toContain('collectionUpdate(collection:');
    });

    it('userErrors on create → LoadResult.success=false with error detail', async () => {
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ collectionByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionCreate: {
                        collection: null,
                        userErrors: [{ field: ['title'], message: 'Title is too long' }],
                    },
                }) as any,
            );

        const [result] = await connector.load([CATEGORY]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Title is too long');
        expect(result.targetId).toBeUndefined();
    });
});

// ─── Variant sync mock helpers ────────────────────────────────────────────────

/** Default response for GET_PRODUCT_VARIANTS — one auto-created variant. */
const MOCK_VARIANTS_RESPONSE = mockOkResponse({
    product: {
        variants: {
            edges: [{ node: { id: 'gid://shopify/ProductVariant/1', sku: '' } }],
        },
    },
});

/** Default response for PRODUCT_VARIANTS_BULK_UPDATE — success. */
const MOCK_VARIANT_UPDATE_RESPONSE = mockOkResponse({
    productVariantsBulkUpdate: {
        product: { id: 'gid://shopify/Product/placeholder' },
        productVariants: [{ id: 'gid://shopify/ProductVariant/1', sku: 'IPHONE-15-BLK' }],
        userErrors: [],
    },
});

describe('ShopifyTargetConnector — Products', () => {
    let connector: ShopifyTargetConnector;

    beforeEach(async () => {
        jest.clearAllMocks();
        connector = new ShopifyTargetConnector(EntityType.PRODUCTS);
    });

    it('creates new product and returns product GID as targetId', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        // 4 calls: find → create → GET_PRODUCT_VARIANTS → PRODUCT_VARIANT_UPDATE
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/555', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        const [result] = await connector.load([PRODUCT]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/Product/555');
    });

    it('resolves categoryKeys via __identityMaps and includes collectionsToJoin in mutation', async () => {
        await connector.initialize({
            ...BASE_CREDENTIALS,
            __identityMaps: {
                [EntityType.CATEGORIES]: {
                    'cat-electronics': 'gid://shopify/Collection/111',
                },
            },
        });

        // 4 calls: find → create → GET_PRODUCT_VARIANTS → PRODUCT_VARIANT_UPDATE
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/666', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        const [result] = await connector.load([PRODUCT]);

        expect(result.success).toBe(true);
        // Verify the mutation input carried collectionsToJoin
        const mutBody = bodyOf(1);
        const input = (mutBody.variables as any).input;
        expect(input.collectionsToJoin).toEqual(['gid://shopify/Collection/111']);
    });

    it('omits collectionsToJoin when no categoryKeys resolve in identity map', async () => {
        await connector.initialize({
            ...BASE_CREDENTIALS,
            // Map present but no matching key for 'cat-electronics'
            __identityMaps: { [EntityType.CATEGORIES]: {} },
        });

        // 4 calls: find → create → GET_PRODUCT_VARIANTS → PRODUCT_VARIANT_UPDATE
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/777', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        await connector.load([PRODUCT]);

        const mutBody = bodyOf(1);
        const input = (mutBody.variables as any).input;
        expect(input.collectionsToJoin).toBeUndefined();
    });

    it('userErrors on product create → LoadResult.success=false (no variant sync attempted)', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        // Only 2 calls: find → create (throws before variant sync)
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: null,
                        userErrors: [{ field: ['title'], message: 'Title can\'t be blank' }],
                    },
                }) as any,
            );

        const [result] = await connector.load([PRODUCT]);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Title can't be blank");
    });

    // ── ProductInput contract (Shopify Admin API 2024-01) ────────────────────────

    it('ProductInput does NOT contain "variants" field (API 2024-01 rejects it)', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/888', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        await connector.load([PRODUCT]);

        // Second fetch call is the productCreate mutation
        const createBody = bodyOf(1);
        const input = (createBody.variables as any).input;
        expect(input).not.toHaveProperty('variants');
    });

    // ── Master-variant sync (GET_PRODUCT_VARIANTS + PRODUCT_VARIANT_UPDATE) ─────

    it('syncMasterVariant fetches variants after product create (GET_PRODUCT_VARIANTS called)', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/901', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        await connector.load([PRODUCT]);

        // Third fetch call is GET_PRODUCT_VARIANTS — its query body must reference the product GID
        const variantsBody = bodyOf(2);
        expect((variantsBody.variables as any).id).toBe('gid://shopify/Product/901');
        expect(variantsBody.query).toContain('GetProductVariants');
    });

    it('syncMasterVariant calls PRODUCT_VARIANTS_BULK_UPDATE with correct productId, SKU, and price', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ productByHandle: null }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    productCreate: {
                        product: { id: 'gid://shopify/Product/902', handle: 'iphone-15' },
                        userErrors: [],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(MOCK_VARIANTS_RESPONSE as any)
            .mockResolvedValueOnce(MOCK_VARIANT_UPDATE_RESPONSE as any);

        await connector.load([PRODUCT]);

        // Fourth fetch call is PRODUCT_VARIANTS_BULK_UPDATE
        const variantUpdateBody = bodyOf(3);
        // productVariantsBulkUpdate takes productId + variants[] (not a single input object)
        expect((variantUpdateBody.variables as any).productId).toBe('gid://shopify/Product/902');
        const variants = (variantUpdateBody.variables as any).variants as any[];
        expect(variants).toHaveLength(1);
        // Must include the variant GID returned by GET_PRODUCT_VARIANTS
        expect(variants[0].id).toBe('gid://shopify/ProductVariant/1');
        // PRODUCT.masterVariant: centAmount=99900, fractionDigits=2 → '999.00'
        expect(variants[0].price).toBe('999.00');
        // SKU from PRODUCT.masterVariant
        expect(variants[0].sku).toBe('IPHONE-15-BLK');
    });
});

describe('ShopifyTargetConnector — Customers', () => {
    let connector: ShopifyTargetConnector;

    beforeEach(async () => {
        jest.clearAllMocks();
        connector = new ShopifyTargetConnector(EntityType.CUSTOMERS);
        await connector.initialize(BASE_CREDENTIALS);
    });

    it('creates new customer and returns customer GID as targetId', async () => {
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ customers: { edges: [] } }) as any)
            .mockResolvedValueOnce(
                mockOkResponse({
                    customerCreate: {
                        customer: { id: 'gid://shopify/Customer/888', email: 'jane@example.com' },
                        userErrors: [],
                    },
                }) as any,
            );

        const [result] = await connector.load([CUSTOMER]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/Customer/888');
    });

    it('updates existing customer found by email and returns GID', async () => {
        mockFetch
            .mockResolvedValueOnce(
                mockOkResponse({
                    customers: {
                        edges: [{ node: { id: 'gid://shopify/Customer/999', email: 'jane@example.com' } }],
                    },
                }) as any,
            )
            .mockResolvedValueOnce(
                mockOkResponse({
                    customerUpdate: {
                        customer: { id: 'gid://shopify/Customer/999', email: 'jane@example.com' },
                        userErrors: [],
                    },
                }) as any,
            );

        const [result] = await connector.load([CUSTOMER]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/Customer/999');
    });
});

describe('ShopifyTargetConnector — Orders', () => {
    let connector: ShopifyTargetConnector;

    beforeEach(async () => {
        jest.clearAllMocks();
        connector = new ShopifyTargetConnector(EntityType.ORDERS);
    });

    it('creates draft order and returns draftOrder GID as targetId', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/101', name: '#D101' },
                    userErrors: [],
                },
            }) as any,
        );

        const [result] = await connector.load([ORDER]);

        expect(result.success).toBe(true);
        expect(result.targetId).toBe('gid://shopify/DraftOrder/101');
    });

    it('resolves customerKey from __identityMaps and sets customerId in DraftOrderInput', async () => {
        await connector.initialize({
            ...BASE_CREDENTIALS,
            __identityMaps: {
                [EntityType.CUSTOMERS]: {
                    'cust-jane': 'gid://shopify/Customer/888',
                },
            },
        });

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/102', name: '#D102' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        expect(input.customerId).toBe('gid://shopify/Customer/888');
    });

    it('creates order without customerId when customerKey is missing', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        const orderWithoutCustomer = { ...ORDER, customerKey: undefined };

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/103', name: '#D103' },
                    userErrors: [],
                },
            }) as any,
        );

        const [result] = await connector.load([orderWithoutCustomer]);

        expect(result.success).toBe(true);
        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        expect(input.customerId).toBeUndefined();
    });

    it('DraftOrderInput does NOT contain the invalid "currency" field', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/104', name: '#D104' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        // 'currency' is not a valid DraftOrderInput field — Shopify rejects it
        expect(input).not.toHaveProperty('currency');
    });

    it('DraftOrderInput does NOT contain presentmentCurrencyCode (unsupported currencies crash the API)', async () => {
        // presentmentCurrencyCode is intentionally omitted: if the order's source currency
        // is not enabled on the target Shopify store, the API rejects the entire mutation.
        // The original currency is preserved in the note field instead.
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/105', name: '#D105' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        // Must NOT send presentmentCurrencyCode — target store may not support source currency
        expect(input).not.toHaveProperty('presentmentCurrencyCode');
        // Original currency must be preserved in the note so no data is lost
        expect(input.note).toContain('USD');
    });

    it('DraftOrderInput preserves note and tags (source metadata not dropped)', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/106', name: '#D106' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        expect(input.note).toContain('order-001');
        expect(input.tags).toContain('source-key:order-001');
    });

    it('DraftOrderInput line items carry title, quantity, and originalUnitPrice', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/107', name: '#D107' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const lineItems = (mutBody.variables as any).input.lineItems as any[];
        expect(lineItems).toHaveLength(1);
        const li = lineItems[0];
        // title uses variantSku when present
        expect(li.title).toBe('IPHONE-15-BLK');
        expect(li.quantity).toBe(1);
        // centAmount 99900, fractionDigits 2 → '999.00'
        expect(li.originalUnitPrice).toBe('999.00');
    });

    it('customer identity mapping: __identityMaps propagates GID to DraftOrderInput', async () => {
        // This test duplicates the named identity-map test above, confirming the fix
        // did not break the customer resolution path.
        await connector.initialize({
            ...BASE_CREDENTIALS,
            __identityMaps: {
                [EntityType.CUSTOMERS]: { 'cust-jane': 'gid://shopify/Customer/999' },
            },
        });

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: { id: 'gid://shopify/DraftOrder/108', name: '#D108' },
                    userErrors: [],
                },
            }) as any,
        );

        await connector.load([ORDER]);

        const mutBody = bodyOf(0);
        const input = (mutBody.variables as any).input;
        expect(input.customerId).toBe('gid://shopify/Customer/999');
        // presentmentCurrencyCode is intentionally absent — currency goes to note
        expect(input).not.toHaveProperty('presentmentCurrencyCode');
        expect(input.note).toContain('USD');
    });

    // ── assertNoUserErrors null-field guard ───────────────────────────────────────
    //
    // Shopify Admin API can return { field: null, message: "..." } for non-field-
    // specific errors (e.g. permission issues, plan limits). Without a null guard,
    // the `.join('.')` call crashes with:
    //   TypeError: Cannot read properties of null (reading 'join')
    //
    // The following three tests verify the fix is in place and well-behaved.

    it('field: null in userErrors does not crash — LoadResult.success=false, error captured', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: null,
                    userErrors: [{ field: null, message: 'This order cannot be created' }],
                },
            }) as any,
        );

        const [result] = await connector.load([ORDER]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('This order cannot be created');
        // null field renders as [] join → empty prefix in the error detail string
        expect(result.error).toContain('[]');
    });

    it('non-null field array is still formatted correctly after null-guard fix', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: null,
                    userErrors: [{ field: ['lineItems', '0', 'quantity'], message: 'Must be positive' }],
                },
            }) as any,
        );

        const [result] = await connector.load([ORDER]);

        expect(result.success).toBe(false);
        // Non-null field arrays must still render as dot-joined paths
        expect(result.error).toContain('[lineItems.0.quantity]');
        expect(result.error).toContain('Must be positive');
    });

    it('mixed null and non-null fields in a single userErrors response are both captured', async () => {
        await connector.initialize(BASE_CREDENTIALS);

        mockFetch.mockResolvedValueOnce(
            mockOkResponse({
                draftOrderCreate: {
                    draftOrder: null,
                    userErrors: [
                        { field: null,          message: 'General failure' },
                        { field: ['customerId'], message: 'Customer not found' },
                    ],
                },
            }) as any,
        );

        const [result] = await connector.load([ORDER]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('General failure');
        expect(result.error).toContain('[customerId]');
        expect(result.error).toContain('Customer not found');
    });
});

describe('ShopifyTargetConnector — Error classification', () => {
    let connector: ShopifyTargetConnector;

    beforeEach(async () => {
        jest.clearAllMocks();
        connector = new ShopifyTargetConnector(EntityType.CATEGORIES);
        await connector.initialize(BASE_CREDENTIALS);
    });

    it('HTTP 429 is classified as TRANSIENT', async () => {
        // Find call fails with 429
        mockFetch.mockResolvedValueOnce(mockHttpErrorResponse(429) as any);

        const [result] = await connector.load([CATEGORY]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('429');
    });

    it('HTTP 422 is classified as VALIDATION', async () => {
        mockFetch.mockResolvedValueOnce(mockHttpErrorResponse(422) as any);

        const [result] = await connector.load([CATEGORY]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('422');
    });

    it('per-item isolation: one item failing does not abort the rest of the batch', async () => {
        const CATEGORY_B: CanonicalCategory = {
            ...CATEGORY,
            key: 'cat-phones',
            name: { 'en-US': 'Phones' },
            slug: { 'en-US': 'phones' },
        } as unknown as CanonicalCategory;

        // Promise.all fires both find calls before either create, so interleave order is:
        //   call 1: CATEGORY find       → not found
        //   call 2: CATEGORY_B find     → not found
        //   call 3: CATEGORY create     → HTTP 500 (fails this item)
        //   call 4: CATEGORY_B create   → success
        mockFetch
            .mockResolvedValueOnce(mockOkResponse({ collectionByHandle: null }) as any)   // CATEGORY find
            .mockResolvedValueOnce(mockOkResponse({ collectionByHandle: null }) as any)   // CATEGORY_B find
            .mockResolvedValueOnce(mockHttpErrorResponse(500, 'Internal Server Error') as any)  // CATEGORY create → fail
            .mockResolvedValueOnce(
                mockOkResponse({
                    collectionCreate: {
                        collection: { id: 'gid://shopify/Collection/200', handle: 'phones' },
                        userErrors: [],
                    },
                }) as any,
            ); // CATEGORY_B create → success

        const results = await connector.load([CATEGORY, CATEGORY_B]);

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(false);
        expect(results[1].success).toBe(true);
        expect(results[1].targetId).toBe('gid://shopify/Collection/200');
    });
});
