/**
 * shopify-oauth.spec.ts
 *
 * Unit tests for the Shopify client-credentials token exchange.
 * All HTTP calls are mocked — no real Shopify store is contacted.
 *
 * Covered:
 *  [1] Successful token generation returns accessToken + scopes
 *  [2] Authentication failure (non-2xx) throws a clear error
 *  [3] Missing required scope causes validateShopifyScopes to throw with scope names
 *  [4] Correct shop URL construction (https://{shop}.myshopify.com/...)
 *  [5] Client secret is never present in thrown error messages
 *  [6] Access token in Shopify error body is redacted before re-throwing
 *  [7] Existing connector behaviour: ShopifyTargetConnector continues to accept
 *      a pre-resolved accessToken from requestShopifyToken (integration sanity)
 */

// ─── Mock node-fetch before any imports ──────────────────────────────────────

const mockFetchFn = jest.fn();
jest.mock('node-fetch', () => mockFetchFn);

import {
    requestShopifyToken,
    validateShopifyScopes,
    REQUIRED_SHOPIFY_SCOPES,
} from '../shopify-oauth';
import { ShopifyTargetConnector } from '../shopify-target.connector';
import { EntityType } from '@cdo/shared';

const mockFetch = mockFetchFn as jest.MockedFunction<typeof mockFetchFn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockOkJson(data: Record<string, unknown>) {
    return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
    } as any;
}

function mockErrorResponse(status: number, body = 'Unauthorized') {
    return {
        ok: false,
        status,
        text: async () => body,
        json: async () => ({}),
    } as any;
}

// ─── requestShopifyToken ──────────────────────────────────────────────────────

describe('requestShopifyToken', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('[1] returns accessToken and scopes on successful authentication', async () => {
        mockFetch.mockResolvedValueOnce(mockOkJson({
            access_token: 'shpat_abc123',
            scope: 'write_products,write_customers,write_draft_orders',
            expires_in: 86400,
        }));

        const result = await requestShopifyToken('my-store', 'client123', 'secret456');

        expect(result.accessToken).toBe('shpat_abc123');
        expect(result.scopes).toBe('write_products,write_customers,write_draft_orders');
    });

    it('[4] constructs the correct Shopify token endpoint URL', async () => {
        mockFetch.mockResolvedValueOnce(mockOkJson({
            access_token: 'shpat_xyz',
            scope: 'write_products',
        }));

        await requestShopifyToken('shivam-rc-dev-1', 'cid', 'csecret');

        const [calledUrl, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(calledUrl).toBe(
            'https://shivam-rc-dev-1.myshopify.com/admin/oauth/access_token',
        );
        expect((options as any).method).toBe('POST');
        expect((options as any).headers['Content-Type']).toBe(
            'application/x-www-form-urlencoded',
        );
    });

    it('[2] throws a clear error on authentication failure (non-2xx response)', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'invalid_client'));

        let caughtError: Error | undefined;
        try {
            await requestShopifyToken('my-store', 'bad-client', 'bad-secret');
        } catch (err: any) {
            caughtError = err;
        }

        expect(caughtError).toBeDefined();
        expect(caughtError!.message).toContain('Shopify authentication failed (HTTP 401)');
    });

    it('[5] client secret is never present in thrown error messages', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'invalid_client'));

        let caughtError: Error | undefined;
        try {
            await requestShopifyToken('my-store', 'cid', 'my-real-secret-xyz');
        } catch (err: any) {
            caughtError = err;
        }

        expect(caughtError).toBeDefined();
        // The actual secret value must not appear anywhere in the error message
        expect(caughtError!.message).not.toContain('my-real-secret-xyz');
    });

    it('[6] access_token-like value in Shopify error body is redacted before re-throwing', async () => {
        // Simulate an error body that contains a token-format string
        mockFetch.mockResolvedValueOnce(
            mockErrorResponse(403, 'shpat_abc123 is invalid or revoked'),
        );

        let caughtError: Error | undefined;
        try {
            await requestShopifyToken('my-store', 'cid', 'csecret');
        } catch (err: any) {
            caughtError = err;
        }

        expect(caughtError).toBeDefined();
        // Raw token string must be redacted
        expect(caughtError!.message).not.toContain('shpat_abc123');
        // But the HTTP status context is still present
        expect(caughtError!.message).toContain('HTTP 403');
    });

    it('throws when Shopify response contains no access_token field', async () => {
        mockFetch.mockResolvedValueOnce(mockOkJson({ scope: 'write_products' }));

        await expect(
            requestShopifyToken('my-store', 'cid', 'csecret'),
        ).rejects.toThrow('valid access_token');
    });

    it('uses grant_type=client_credentials in the request body', async () => {
        mockFetch.mockResolvedValueOnce(mockOkJson({
            access_token: 'shpat_test',
            scope: 'write_products',
        }));

        await requestShopifyToken('my-store', 'client-id', 'client-secret');

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const sentBody = (options as any).body as string;

        expect(sentBody).toContain('grant_type=client_credentials');
        expect(sentBody).toContain('client_id=client-id');
        // client_secret IS sent to Shopify in the request body — but must not appear in logs/errors
        expect(sentBody).toContain('client_secret=client-secret');
    });
});

// ─── validateShopifyScopes ────────────────────────────────────────────────────

describe('validateShopifyScopes', () => {
    it('[3-pass] does not throw when all required scopes are present', () => {
        // Superset of required scopes (extra scopes are fine)
        const scopes = 'write_products,write_customers,write_draft_orders,read_orders';
        expect(() => validateShopifyScopes(scopes)).not.toThrow();
    });

    it('[3-single] throws naming the missing scope when one is absent', () => {
        const scopes = 'write_products,write_customers';
        expect(() => validateShopifyScopes(scopes)).toThrow('write_draft_orders');
    });

    it('[3-multi] throws listing ALL missing scopes when multiple are absent', () => {
        const scopes = 'read_orders';
        let caughtError: Error | undefined;
        try {
            validateShopifyScopes(scopes);
        } catch (err: any) {
            caughtError = err;
        }
        expect(caughtError).toBeDefined();
        expect(caughtError!.message).toContain('write_products');
        expect(caughtError!.message).toContain('write_customers');
        expect(caughtError!.message).toContain('write_draft_orders');
    });

    it('[3-empty] throws on empty scope string', () => {
        expect(() => validateShopifyScopes('')).toThrow('missing required scope');
    });

    it('handles whitespace around scope names gracefully', () => {
        // Shopify sometimes returns space-padded scopes
        const scopes = ' write_products , write_customers , write_draft_orders ';
        expect(() => validateShopifyScopes(scopes)).not.toThrow();
    });

    it('REQUIRED_SHOPIFY_SCOPES contains the three connector-required scopes', () => {
        expect(REQUIRED_SHOPIFY_SCOPES).toContain('write_products');
        expect(REQUIRED_SHOPIFY_SCOPES).toContain('write_customers');
        expect(REQUIRED_SHOPIFY_SCOPES).toContain('write_draft_orders');
        expect(REQUIRED_SHOPIFY_SCOPES).toHaveLength(3);
    });
});

// ─── [7] Integration sanity: connector accepts token from requestShopifyToken ─

describe('[7] ShopifyTargetConnector accepts token obtained via requestShopifyToken', () => {
    it('initialize() succeeds when passed a resolved accessToken', async () => {
        // Simulate what the smoke harness does: obtain token, then initialize connector
        const fakeToken = 'shpat_obtained_via_oauth';

        const connector = new ShopifyTargetConnector(EntityType.CATEGORIES);
        // Should not throw — the connector only validates presence, not format
        await expect(
            connector.initialize({ shopName: 'test-store', accessToken: fakeToken }),
        ).resolves.toBeUndefined();
    });
});
