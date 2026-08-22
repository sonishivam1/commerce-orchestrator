import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createRedisConnection } from '@cdo/redis';

/**
 * Redis-backed throttler storage for @nestjs/throttler.
 *
 * Uses a Lua script for atomic increment + block management so that
 * concurrent requests on distributed API replicas don't race past the limit.
 *
 * Key layout (all keys prefixed with "throttle:"):
 *   throttle:{key}          – INCR counter, expires after TTL ms
 *   throttle:{key}:blocked  – "1" string, expires after blockDuration ms
 *
 * The `key` argument passed by ThrottlerGuard already encodes the throttler
 * name and the tracker (tenantId or IP), so no further namespacing is needed.
 */
@Injectable()
export class RedisThrottlerStorage
    implements ThrottlerStorage, OnApplicationShutdown
{
    private readonly logger = new Logger(RedisThrottlerStorage.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly redis: any;

    // Lua script: atomic increment + block-state management.
    //
    // KEYS[1] = hit-counter key
    // KEYS[2] = block-state key
    // ARGV[1] = ttl (ms)
    // ARGV[2] = limit
    // ARGV[3] = blockDuration (ms)
    //
    // Returns: [totalHits, timeToExpire (s), isBlocked (0|1), timeToBlockExpire (s)]
    private static readonly LUA_INCREMENT = `
local key       = KEYS[1]
local blockKey  = KEYS[2]
local ttlMs     = tonumber(ARGV[1])
local limit     = tonumber(ARGV[2])
local blockMs   = tonumber(ARGV[3])

-- Check current block state
local isBlocked     = tonumber(redis.call('GET', blockKey) or '0')
local blockPttl     = redis.call('PTTL', blockKey)

-- Clear stale block (key exists but already expired — should not happen, but guard anyway)
if isBlocked == 1 and blockPttl <= 0 then
    redis.call('DEL', blockKey)
    redis.call('DEL', key)
    isBlocked = 0
    blockPttl = 0
end

-- Increment hit count (skip while blocked — client already over limit)
local count = 0
if isBlocked == 0 then
    count = redis.call('INCR', key)
    -- Set TTL on first hit only (subsequent hits inherit the existing window)
    if count == 1 then
        redis.call('PEXPIRE', key, ttlMs)
    end
end

-- Remaining window TTL in seconds
local pttl = redis.call('PTTL', key)
local timeToExpire = math.ceil(pttl / 1000)
if timeToExpire < 0 then timeToExpire = 0 end

-- Apply block when limit exceeded for the first time
local timeToBlockExpire = 0
if count > limit and isBlocked == 0 and blockMs > 0 then
    redis.call('SET', blockKey, '1')
    redis.call('PEXPIRE', blockKey, blockMs)
    isBlocked = 1
    timeToBlockExpire = math.ceil(blockMs / 1000)
elseif isBlocked == 1 then
    timeToBlockExpire = math.ceil(blockPttl / 1000)
    if timeToBlockExpire < 0 then timeToBlockExpire = 0 end
    -- Report count as limit+1 so the guard sees the limit exceeded
    count = limit + 1
end

return {count, timeToExpire, isBlocked, timeToBlockExpire}
`;

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.redis = createRedisConnection() as any;
    }

    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        _throttlerName: string,
    ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
        const hitKey   = `throttle:${key}`;
        const blockKey = `throttle:${key}:blocked`;

        try {
            const result = await (this.redis as any).eval(
                RedisThrottlerStorage.LUA_INCREMENT,
                2,              // number of KEYS
                hitKey,
                blockKey,
                String(ttl),
                String(limit),
                String(blockDuration ?? 0),
            ) as [number, number, number, number];

            const [totalHits, timeToExpire, isBlockedNum, timeToBlockExpire] = result;

            return {
                totalHits,
                timeToExpire,
                isBlocked: isBlockedNum === 1,
                timeToBlockExpire,
            };
        } catch (err: unknown) {
            // Redis unavailable — degrade gracefully: allow the request through
            // rather than crashing the API. Rate limiting resumes automatically
            // once the Redis connection recovers.
            this.logger.warn(
                `[RateLimit] Redis unavailable, allowing request (key=${key}): ${(err as Error).message}`,
            );
            return {
                totalHits:        1,
                timeToExpire:     ttl / 1000,
                isBlocked:        false,
                timeToBlockExpire: 0,
            };
        }
    }

    onApplicationShutdown(): void {
        this.redis.quit().catch(() => {/* ignore on shutdown */});
    }
}
