/**
 * @file lock.service.ts — Scrape worker Redlock service
 * Mirrors the ETL worker's lock service. Scrape jobs lock on `targetCredentialId`
 * to prevent concurrent writes to the same target store.
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
            this.logger.warn(`Redlock unavailable: ${(err as Error).message}`);
        }
    }

    async acquire(tenantId: string, targetCredentialId: string): Promise<Lock | null> {
        if (!this.redlock) return null;
        const key = `${LOCK_KEY_PREFIX}:${tenantId}:${targetCredentialId}`;
        try {
            const lock = await this.redlock.acquire([key], LOCK_TTL_MS);
            this.logger.log(`Lock acquired: ${key}`);
            return lock;
        } catch (err) {
            throw new Error(`Failed to acquire Redlock for ${key}: ${(err as Error).message}`);
        }
    }

    async release(lock: Lock | null): Promise<void> {
        if (!lock || !this.redlock) return;
        try {
            await this.redlock.release(lock);
        } catch (err) {
            this.logger.warn(`Redlock release failed: ${(err as Error).message}`);
        }
    }

    async extend(lock: Lock, ttl: number): Promise<Lock> {
        if (!this.redlock) throw new Error('Redlock not initialised');
        return this.redlock.extend(lock, ttl);
    }
}
