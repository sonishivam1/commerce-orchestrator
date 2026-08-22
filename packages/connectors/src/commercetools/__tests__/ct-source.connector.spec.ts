/**
 * ct-source.connector.spec.ts
 *
 * Unit tests for CommercetoolsSourceConnector — product extraction path.
 *
 * Mock strategy: jest.mock('@commercetools/platform-sdk') and
 * jest.mock('@commercetools/sdk-client-v2') so that initialize() wires
 * this.client to a controlled mockCtClient without hitting any real API.
 *
 * Covered:
 *   [1] mapCommercetoolsProduct handles ProductProjection shape (flat fields)
 *   [2] extractProducts calls productProjections(), not products()
 *   [3] extractProducts passes staged: true to include unpublished B2B products
 *   [4] Cursor-based pagination — sort, where, limit are preserved
 */

// ─── CT SDK mocks ─────────────────────────────────────────────────────────────

// Shared execute mock — reset before each test via beforeEach
const mockExecute = jest.fn();

// Separate getters so each test can inspect call arguments
const mockProductProjectionsGetFn = jest.fn(() => ({ execute: mockExecute }));
const mockProductsGetFn = jest.fn(() => ({ execute: mockExecute }));

const mockCtClient = {
    productProjections: jest.fn(() => ({ get: mockProductProjectionsGetFn })),
    products:           jest.fn(() => ({ get: mockProductsGetFn })),
    categories:         jest.fn(() => ({ get: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({ body: { results: [] } }) })) })),
    customers:          jest.fn(() => ({ get: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({ body: { results: [] } }) })) })),
    orders:             jest.fn(() => ({ get: jest.fn(() => ({ execute: jest.fn().mockResolvedValue({ body: { results: [] } }) })) })),
};

jest.mock('@commercetools/platform-sdk', () => ({
    createApiBuilderFromCtpClient: jest.fn(() => ({
        withProjectKey: jest.fn(() => mockCtClient),
    })),
}));

jest.mock('@commercetools/sdk-client-v2', () => ({
    ClientBuilder: jest.fn().mockImplementation(() => ({
        withProjectKey:              jest.fn().mockReturnThis(),
        withClientCredentialsFlow:   jest.fn().mockReturnThis(),
        withHttpMiddleware:           jest.fn().mockReturnThis(),
        build:                       jest.fn(() => ({})),
    })),
}));

// node-fetch is no longer imported; connector uses globalThis.fetch (Node 18+)

// ─── System under test ────────────────────────────────────────────────────────

import { CommercetoolsSourceConnector } from '../ct-source.connector';
import { EntityType } from '@cdo/shared';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A valid Commercetools ProductProjection object (flat shape).
 * This is the format returned by GET /product-projections and the shape
 * that mapCommercetoolsProduct() expects.
 */
const MOCK_PRODUCT_PROJECTION = {
    id:   'ct-prod-001',
    key:  'test-product-key',
    name:        { 'en-US': 'Test Product' },
    description: { 'en-US': 'A test product description' },
    slug:        { 'en-US': 'test-product-key' },
    published:   true,
    hasStagedChanges: false,
    categories: [{ id: 'cat-001', typeId: 'category' }],
    masterVariant: {
        id:  1,
        sku: 'SKU-001',
        prices: [
            {
                value: {
                    centAmount:    1999,
                    currencyCode:  'USD',
                    fractionDigits: 2,
                },
            },
        ],
        attributes: [{ name: 'color', value: 'red' }],
        images: [{ url: 'https://example.com/images/product.jpg' }],
    },
    variants:    [],
    productType: { id: 'pt-001', typeId: 'product-type' },
};

/**
 * A staged-only (unpublished) ProductProjection — typical in B2B shops where
 * products are never published to a storefront channel.
 */
const MOCK_STAGED_PROJECTION = {
    ...MOCK_PRODUCT_PROJECTION,
    id:        'ct-prod-staged',
    key:       'staged-b2b-product',
    slug:      { 'en-US': 'staged-b2b-product' },
    published: false,
    hasStagedChanges: true,
};

/** Minimal credentials that satisfy CommercetoolsSourceConnector.initialize(). */
const CT_CREDENTIALS = {
    projectKey:   'test-project',
    clientId:     'test-client-id',
    clientSecret: 'test-client-secret',
    apiUrl:       'https://api.example.com',
    authUrl:      'https://auth.example.com',
    scopes:       ['manage_project'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function drainConnector(
    connector: CommercetoolsSourceConnector,
): Promise<import('@cdo/shared').CanonicalEntity[]> {
    const items: import('@cdo/shared').CanonicalEntity[] = [];
    for await (const batch of connector.extract()) {
        items.push(...batch);
    }
    return items;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommercetoolsSourceConnector — extractProducts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── [1] ProductProjection shape maps successfully ─────────────────────────

    it('[1] a valid ProductProjection (flat fields) maps to a CanonicalProduct without Zod errors', async () => {
        // First page: one product; second page: empty → terminates loop.
        mockExecute
            .mockResolvedValueOnce({ body: { results: [MOCK_PRODUCT_PROJECTION] } })
            .mockResolvedValueOnce({ body: { results: [] } });

        const connector = new CommercetoolsSourceConnector(EntityType.PRODUCTS);
        await connector.initialize(CT_CREDENTIALS);

        const items = await drainConnector(connector);

        expect(items).toHaveLength(1);

        const product = items[0] as import('@cdo/shared').CanonicalProduct;
        expect(product._version).toBe('v1');
        expect(product.key).toBe('test-product-key');
        expect(product.name['en-US']).toBe('Test Product');
        expect(product.description['en-US']).toBe('A test product description');
        expect(product.slug['en-US']).toBe('test-product-key');
        expect(product.masterVariant.sku).toBe('SKU-001');
        expect(product.masterVariant.prices).toHaveLength(1);
        expect(product.masterVariant.prices[0].centAmount).toBe(1999);
        expect(product.masterVariant.prices[0].currencyCode).toBe('USD');
        expect(product.categoryKeys).toContain('cat-001');
    });

    // ── [2] productProjections() is called — products() is not ───────────────

    it('[2] extractProducts calls productProjections(), not products()', async () => {
        // One product page then empty to terminate.
        mockExecute
            .mockResolvedValueOnce({ body: { results: [MOCK_PRODUCT_PROJECTION] } })
            .mockResolvedValueOnce({ body: { results: [] } });

        const connector = new CommercetoolsSourceConnector(EntityType.PRODUCTS);
        await connector.initialize(CT_CREDENTIALS);
        await drainConnector(connector);

        // productProjections() must have been called (at least once — one per page)
        expect(mockCtClient.productProjections).toHaveBeenCalled();

        // products() must NEVER be called during product extraction
        expect(mockCtClient.products).not.toHaveBeenCalled();
    });

    // ── [3] staged: true is passed to include unpublished B2B products ────────

    it('[3] extractProducts passes staged: true to include unpublished products', async () => {
        // Simulate a B2B project with only a staged/unpublished product.
        mockExecute
            .mockResolvedValueOnce({ body: { results: [MOCK_STAGED_PROJECTION] } })
            .mockResolvedValueOnce({ body: { results: [] } });

        const connector = new CommercetoolsSourceConnector(EntityType.PRODUCTS);
        await connector.initialize(CT_CREDENTIALS);
        const items = await drainConnector(connector);

        // The staged product must be extracted (not filtered out)
        expect(items).toHaveLength(1);
        expect((items[0] as import('@cdo/shared').CanonicalProduct).key).toBe('staged-b2b-product');

        // The query passed to get() must include staged: true
        expect(mockProductProjectionsGetFn).toHaveBeenCalledWith(
            expect.objectContaining({
                queryArgs: expect.objectContaining({ staged: true }),
            }),
        );
    });

    // ── [4] Cursor / pagination arguments are preserved ───────────────────────

    it('[4] extractProducts preserves sort: id asc, limit: 50, where: id > cursor pagination', async () => {
        mockExecute
            .mockResolvedValueOnce({ body: { results: [MOCK_PRODUCT_PROJECTION] } })
            .mockResolvedValueOnce({ body: { results: [] } });

        const connector = new CommercetoolsSourceConnector(EntityType.PRODUCTS);
        await connector.initialize(CT_CREDENTIALS);
        await drainConnector(connector);

        // First page — no cursor yet, where omitted (undefined)
        expect(mockProductProjectionsGetFn).toHaveBeenNthCalledWith(1,
            expect.objectContaining({
                queryArgs: expect.objectContaining({
                    staged:    true,
                    sort:      'id asc',
                    limit:     50,
                    withTotal: false,
                    // where must be absent (no cursor at start)
                }),
            }),
        );
        // The where key must be undefined on the first call
        const firstQueryArgs = (mockProductProjectionsGetFn.mock.calls[0] as unknown as [{ queryArgs: Record<string, unknown> }])[0].queryArgs;
        expect(firstQueryArgs.where).toBeUndefined();

        // Second page — cursor advances to the last id of page 1
        expect(mockProductProjectionsGetFn).toHaveBeenNthCalledWith(2,
            expect.objectContaining({
                queryArgs: expect.objectContaining({
                    staged: true,
                    where:  `id > "ct-prod-001"`,
                }),
            }),
        );
    });
});
