import type { CanonicalEntity } from '@cdo/shared';

/**
 * SourceConnector — framework-agnostic interface for all data extraction sources.
 * Implemented by: Platform API connectors, Scraper adapters.
 *
 * MUST NOT import NestJS, Mongoose, or BullMQ — pure TypeScript only.
 */
export interface SourceConnector<T extends CanonicalEntity = CanonicalEntity> {
    /**
     * Called once before extract(). Receives decrypted credentials from the Orchestrator.
     */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /**
     * Async generator that yields batches of Canonical entities.
     * Uses cursor-based pagination for memory safety on large datasets.
     */
    extract(cursor?: string): AsyncIterableIterator<T[]>;
}
