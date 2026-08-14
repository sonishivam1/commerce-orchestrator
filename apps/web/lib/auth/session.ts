/**
 * @file session.ts
 * Centralised token management for the web app.
 * All reads and writes to the auth token go through here.
 *
 * Uses localStorage (client-side only) as the storage layer.
 * The token is also mirrored to a cookie so Next.js middleware can read it
 * server-side without a round-trip to the client.
 */

const TOKEN_KEY = 'access_token';
const COOKIE_NAME = 'cdo_token';

/** Store the JWT returned from login. Sets both localStorage and a cookie. */
export function setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    // Mirror to cookie for middleware access (http-only not needed here — used by Next.js middleware only)
    document.cookie = `${COOKIE_NAME}=${token}; path=/; SameSite=Strict`;
}

/** Retrieve the current JWT. Returns null if not authenticated. */
export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

/** Clear the auth token on logout. */
export function clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    // Expire the cookie
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Quick check for authenticated state without parsing the JWT. */
export function isAuthenticated(): boolean {
    return Boolean(getToken());
}

/** Decode the JWT payload (no verification — trust the server to reject invalid tokens). */
export function decodeToken(token: string): Record<string, unknown> | null {
    try {
        const [, payloadB64] = token.split('.');
        const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/** Return the tenantId from the stored token, or null. */
export function getTenantId(): string | null {
    const token = getToken();
    if (!token) return null;
    const payload = decodeToken(token);
    return (payload?.sub as string) ?? null;
}
