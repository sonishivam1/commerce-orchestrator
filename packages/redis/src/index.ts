import Redis from 'ioredis';

/**
 * Creates a Redis connection based on the environment.
 * If REDIS_HOST is missing, it returns an in-memory mock connection.
 */
export function createRedisConnection() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    if (!host) {
        // We defer the require to avoid loading the mock unless strictly needed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RedisMock = require('ioredis-mock');
        console.log('🏗️  [Redis] REDIS_HOST not set. Initializing Virtual Redis (In-Memory Mock)');
        return new RedisMock();
    }

    console.log(`🔌 [Redis] Connecting to real Redis at ${host}:${port}`);
    return new Redis({
        host,
        port,
        password,
        maxRetriesPerRequest: null, // Required by BullMQ
    });
}
