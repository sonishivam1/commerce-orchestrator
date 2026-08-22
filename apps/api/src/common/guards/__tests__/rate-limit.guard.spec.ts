/**
 * rate-limit.guard.spec.ts
 *
 * Unit tests for RateLimitGuard.getTracker() — the method that determines
 * which rate-limit bucket a request falls into.
 *
 * We test getTracker() directly by subclassing RateLimitGuard and calling the
 * protected method, which avoids having to bootstrap a full NestJS application.
 *
 * Covered:
 *   [1] Authenticated request with tenantId → `tenant:{tenantId}`
 *   [2] Unauthenticated request with IP → returns the IP string
 *   [3] Unauthenticated request with no IP → `'anonymous'`
 *   [4] req.user present but tenantId missing → falls back to IP
 */

import { RateLimitGuard } from '../rate-limit.guard';

// ── Minimal stub of ThrottlerGuard dependencies ─────────────────────────────
// RateLimitGuard extends ThrottlerGuard. We only test getTracker(), which
// has no dependency on the parent class state, so we can safely construct
// the subclass with null-ish values for the injected tokens.
class TestableRateLimitGuard extends RateLimitGuard {
    constructor() {
        // Pass stub values for ThrottlerModuleOptions, ThrottlerStorage, Reflector
        super(
            { throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] } as any,
            {} as any,
            {} as any,
        );
    }

    // Expose the protected method for direct testing
    public async testGetTracker(req: Record<string, any>): Promise<string> {
        return this.getTracker(req);
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RateLimitGuard.getTracker()', () => {

    let guard: TestableRateLimitGuard;

    beforeEach(() => {
        guard = new TestableRateLimitGuard();
    });

    it('[1] authenticated request — returns tenant:{tenantId}', async () => {
        const req = { user: { tenantId: 'tenant-abc-123' }, ip: '10.0.0.1' };
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('tenant:tenant-abc-123');
    });

    it('[2] unauthenticated request with IP — returns the client IP', async () => {
        const req = { ip: '203.0.113.42' };
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('203.0.113.42');
    });

    it('[3] unauthenticated request with no IP — returns "anonymous"', async () => {
        const req = {};
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('anonymous');
    });

    it('[4] req.user present but tenantId undefined — falls back to IP', async () => {
        const req = { user: { email: 'user@example.com' }, ip: '192.168.1.1' };
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('192.168.1.1');
    });

    it('[5] socket remoteAddress used when req.ip is undefined', async () => {
        const req = { socket: { remoteAddress: '::1' } };
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('::1');
    });

    it('[6] tenantId takes precedence over IP even when both are set', async () => {
        const req = {
            user: { tenantId: 'high-volume-tenant' },
            ip: '1.2.3.4',
        };
        const tracker = await guard.testGetTracker(req);
        expect(tracker).toBe('tenant:high-volume-tenant');
    });
});
