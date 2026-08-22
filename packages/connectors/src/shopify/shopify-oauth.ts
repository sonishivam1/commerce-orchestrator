/**
 * shopify-oauth.ts
 *
 * Shopify Admin API client-credentials token exchange for the smoke harness.
 *
 * The Shopify app installed on a development store supports the client_credentials
 * OAuth grant. This module exchanges SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET for
 * a short-lived Admin API access token at runtime, so no static SHOPIFY_ACCESS_TOKEN
 * needs to be maintained in the root .env.
 *
 * ─── Security contract ────────────────────────────────────────────────────────
 *  - This module NEVER logs, prints, or includes clientSecret in any thrown message.
 *  - accessToken is never logged or included in thrown error messages.
 *  - Error bodies from Shopify are sanitized before being surfaced to callers.
 */

// Native fetch is available in Node 18+ (global)

/** Scopes required by ShopifyTargetConnector for the CT → Shopify migration. */
export const REQUIRED_SHOPIFY_SCOPES = [
    'write_products',
    'write_customers',
    'write_draft_orders',
] as const;

export interface ShopifyTokenResult {
    /** The Admin API access token. Never log or persist this value. */
    accessToken: string;
    /** Comma-separated scopes granted by Shopify. */
    scopes: string;
}

/**
 * Exchange Shopify app client credentials for an Admin API access token.
 *
 * Endpoint: POST https://{shop}.myshopify.com/admin/oauth/access_token
 * Grant:    client_credentials
 *
 * @param shop         Shopify shop subdomain (without .myshopify.com)
 * @param clientId     Shopify app client ID (SHOPIFY_CLIENT_ID)
 * @param clientSecret Shopify app client secret — NEVER logged or re-thrown verbatim
 * @returns ShopifyTokenResult with the access token and granted scope string
 * @throws  Error (sanitized) on authentication failure or missing token in response
 */
export async function requestShopifyToken(
    shop: string,
    clientId: string,
    clientSecret: string,
): Promise<ShopifyTokenResult> {
    const url = `https://${shop}.myshopify.com/admin/oauth/access_token`;

    // ── Safe diagnostics — no secret values are logged ───────────────────────
    // These lines are intentionally verbose to help diagnose OAuth failures.
    // client_id and client_secret values are NEVER logged — only presence and length.
    console.log(`   [oauth] shop domain    : ${shop}.myshopify.com`);
    console.log(`   [oauth] token endpoint : ${url}`);
    console.log(`   [oauth] client_id      : ${clientId ? `present (length=${clientId.length})` : 'MISSING OR EMPTY'}`);
    console.log(`   [oauth] client_secret  : ${clientSecret ? `present (length=${clientSecret.length})` : 'MISSING OR EMPTY'}`);
    console.log(`   [oauth] grant_type     : client_credentials`);
    // ─────────────────────────────────────────────────────────────────────────

    const formBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
    });

    console.log(`   [oauth] HTTP status    : ${response.status}`);

    if (!response.ok) {
        const rawText = await response.text().catch(() => '(unreadable response)');
        const sanitized = sanitizeErrorBody(rawText);
        console.log(`   [oauth] response body  : ${sanitized}`);
        throw new Error(
            `Shopify authentication failed (HTTP ${response.status}): ${sanitized}`,
        );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const accessToken = json['access_token'];
    const scopes = json['scope'] ?? '';

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
        throw new Error(
            'Shopify authentication response did not include a valid access_token field.',
        );
    }

    return {
        accessToken,
        scopes: typeof scopes === 'string' ? scopes : String(scopes),
    };
}

/**
 * Assert that all required scopes are present in the granted scope string.
 * Throws a descriptive error listing the missing scopes so the operator knows
 * exactly which Shopify app permissions need to be added before retrying.
 *
 * @param grantedScopesStr  Comma-separated scope string from the token response
 * @param required          Scopes to require (defaults to REQUIRED_SHOPIFY_SCOPES)
 * @throws Error listing missing scopes
 */
export function validateShopifyScopes(
    grantedScopesStr: string,
    required: readonly string[] = REQUIRED_SHOPIFY_SCOPES,
): void {
    const granted = new Set(
        grantedScopesStr.split(',').map(s => s.trim()).filter(Boolean),
    );
    const missing = required.filter(s => !granted.has(s));

    if (missing.length > 0) {
        throw new Error(
            `Shopify token is missing required scope(s): ${missing.join(', ')}.\n` +
            `  Granted scopes: ${grantedScopesStr || '(none)'}`,
        );
    }
}

/**
 * Sanitize an HTTP error body before including it in a thrown error message.
 * Strips token-like substrings and caps length to prevent credential leakage.
 */
function sanitizeErrorBody(body: string): string {
    return body
        // Redact shpat_/shpss_/shpca_ style Shopify tokens
        .replace(/shp[a-z]{2,3}_[A-Za-z0-9]+/g, '[REDACTED]')
        // Redact "access_token":"..." in JSON bodies
        .replace(/"access_token"\s*:\s*"[^"]*"/g, '"access_token":"[REDACTED]"')
        // Truncate to avoid giant payloads in error messages
        .slice(0, 300);
}
