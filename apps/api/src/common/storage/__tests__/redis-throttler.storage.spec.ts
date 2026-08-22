/**
 * redis-throttler.storage.spec.ts
 *
 * Unit tests for RedisThrottlerStorage.
 *
 * The Redis connection is replaced with ioredis-mock so no real Redis is
 * required. We patch `createRedisConnection` before importing the storage
 * so the constructor receives the mock client.
 *
 * Covered:
 *   [1] First request — counter initialised, TTL set, not blocked
 *   [2] Requests within limit — counter increments, not blocked
 *   [3] Request that crosses the limit — isBlocked=true returned
 *   [4] Subsequent requests while blocked — totalHits stays at limit+1, isBlocked remains true
 *   [5] blockDuration=0 — block key never set even when limit exceeded
 */

// ── Mock @cdo/redis before any import touches it ───────────────────────────
const RedisMock = require('ioredis-mock');
const mockRedisInstance = new RedisMock();

jest.mock('@cdo/redis', () => ({
    createRedisConnection: jest.fn(() => mockRedisInstance),
}));

import { RedisThrottlerStorage } from '../redis-throttler.storage';

// ─── Helpers ────────────────────────────────────────────────────────────────

const THROTTLER_NAME = 'default';
const TTL_MS         = 60_000; // 60 seconds
const LIMIT          = 3;
const BLOCK_MS       = 120_000; // 2 minutes

function buildStorage() {
    return new RedisThrottlerStorage();
}

/** Call increment `n` times for the same key and return results. */
async function hitN(storage: RedisThrottlerStorage, key: string, n: number) {
    const results = [];
    for (let i = 0; i < n; i++) {
        results.push(
            await storage.increment(key, TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME),
        );
    }
    return results;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
    // Flush ioredis-mock state between tests
    await mockRedisInstance.flushall();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('RedisThrottlerStorage.increment()', () => {

    it('[1] first request — counter=1, not blocked, timeToExpire > 0', async () => {
        const storage = buildStorage();
        const result  = await storage.increment('k1', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);

        expect(result.totalHits).toBe(1);
        expect(result.isBlocked).toBe(false);
        expect(result.timeToExpire).toBeGreaterThan(0);
        expect(result.timeToBlockExpire).toBe(0);
    });

    it('[2] requests within limit — counter increments, not blocked', async () => {
        const storage  = buildStorage();
        const results  = await hitN(storage, 'k2', LIMIT); // exactly at the limit

        const last = results[results.length - 1];
        expect(last.totalHits).toBe(LIMIT);
        expect(last.isBlocked).toBe(false);
    });

    it('[3] request that crosses the limit — isBlocked=true', async () => {
        const storage = buildStorage();
        await hitN(storage, 'k3', LIMIT); // at limit but not blocked yet

        // One more request pushes over
        const over = await storage.increment('k3', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);

        expect(over.totalHits).toBeGreaterThan(LIMIT);
        expect(over.isBlocked).toBe(true);
        expect(over.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('[4] subsequent requests while blocked — totalHits stays at limit+1, remains blocked', async () => {
        const storage = buildStorage();
        await hitN(storage, 'k4', LIMIT + 1); // push into blocked state

        const blocked1 = await storage.increment('k4', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);
        const blocked2 = await storage.increment('k4', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);

        expect(blocked1.isBlocked).toBe(true);
        expect(blocked2.isBlocked).toBe(true);
        // Counter stays frozen at limit+1 while blocked
        expect(blocked1.totalHits).toBe(LIMIT + 1);
        expect(blocked2.totalHits).toBe(LIMIT + 1);
    });

    it('[5] blockDuration=0 — limit exceeded but block key never set', async () => {
        const storage   = buildStorage();
        const noBlockMs = 0;

        // Push past the limit with blockDuration=0
        for (let i = 0; i <= LIMIT; i++) {
            await storage.increment('k5', TTL_MS, LIMIT, noBlockMs, THROTTLER_NAME);
        }

        const result = await storage.increment('k5', TTL_MS, LIMIT, noBlockMs, THROTTLER_NAME);
        // Guard never blocks because blockDuration is 0
        expect(result.isBlocked).toBe(false);
    });

    it('[6] different keys are tracked independently', async () => {
        const storage = buildStorage();
        await hitN(storage, 'ka', 1);
        await hitN(storage, 'kb', 2);

        const a = await storage.increment('ka', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);
        const b = await storage.increment('kb', TTL_MS, LIMIT, BLOCK_MS, THROTTLER_NAME);

        expect(a.totalHits).toBe(2);
        expect(b.totalHits).toBe(3);
        expect(b.isBlocked).toBe(false); // 3 === LIMIT, not yet over
    });
});
