/**
 * @file lock.service.ts
 *
 * Distributed Redlock service for the ETL worker plane.
 *
 * Prevents concurrent destructive operations from two worker instances
 * writing to the same target platform credentials simultaneously.
 *
 * Lock key format: `lock:{tenantId}:{targetCredentialId}`
 * TTL: 30 minutes (from LOCK_TTL_MS constant) — always released in finally block.
 *
 * If Redis is unavailable the service logs a warning and proceeds without locking
 * so jobs are not permanently blocked in dev environments without Redis.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redlock, { Lock } from 'redlock';
import { createRedisConnection } from '@cdo/redis';
import { LOCK_KEY_PREFIX, LOCK_TTL_MS } from '@cdo/shared';

@Injectable()
export class LockService implements OnModuleInit {
    private readonly logger = new Logger(LockService.name);
    private redlock: Redlock | null = null;

    onModuleInit() {
        try {
            const client = createRedisConnection();
            this.redlock = new Redlock([client as any], {
                retryCount: 5,
                retryDelay: 200,
                retryJitter: 50,
            });

            this.redlock.on('error', (err) => {
                this.logger.error(`Redlock error: ${err.message}`);
            });

            this.logger.log('Redlock initialised ✓');
        } catch (err) {
            this.logger.warn(
                `Redlock could not initialise (${(err as Error).message}). Running without distributed locks — only safe in single-worker dev environments.`,
            );
        }
    }

    /**
     * Acquire an exclusive lock on the given key.
     * Returns the lock handle (needed to release) or null if Redlock is unavailable.
     */
    async acquire(tenantId: string, targetCredentialId: string): Promise<Lock | null> {
        if (!this.redlock) return null;

        const key = `${LOCK_KEY_PREFIX}:${tenantId}:${targetCredentialId}`;
        try {
            const lock = await this.redlock.acquire([key], LOCK_TTL_MS);
            this.logger.log(`Lock acquired for key: ${key}`);
            return lock;
        } catch (err) {
            throw new Error(
                `Failed to acquire Redlock for ${key}: ${(err as Error).message}. Another job may be running for this tenant+target combination.`,
            );
        }
    }

    /**
     * Release a previously acquired lock.
     * Safe to call with null (no-op when Redlock is unavailable).
     */
    async release(lock: Lock | null): Promise<void> {
        if (!lock || !this.redlock) return;
        try {
            await this.redlock.release(lock);
        } catch (err) {
            // Log but don't rethrow — lock will expire via TTL regardless
            this.logger.warn(`Failed to release Redlock cleanly: ${(err as Error).message}`);
        }
    }
}
