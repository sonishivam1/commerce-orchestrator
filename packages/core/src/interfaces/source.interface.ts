import type { CanonicalEntity } from '@cdo/shared';

/**
 * SourceConnector — framework-agnostic interface for all data extraction sources.
 * Implemented by: Platform API connectors, Scraper adapters.
 *
 * MUST NOT import NestJS, Mongoose, or BullMQ — pure TypeScript only.
 */
export interface SourceConnector<T extends CanonicalEntity = CanonicalEntity> {
    /**
     * Called once before extract(). Receives decrypted source credentials from the Orchestrator.
     */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /**
     * Async generator that yields batches of Canonical entities.
     * Uses cursor-based pagination for memory safety on large datasets.
     *
     * @param cursor - Opaque resume token from a previous partial run.
     *                 When supplied the connector resumes extraction from
     *                 the position immediately after this cursor value.
     *                 When absent (or undefined) extraction starts from the beginning.
     */
    extract(cursor?: string): AsyncIterableIterator<T[]>;

    /**
     * Returns the most-recently-checkpointed cursor value — the last ID that was
     * successfully yielded AND processed by the target.
     *
     * Called from the wave executor's progress handler (after target.load() succeeds)
     * so the value is always the cursor AFTER the last committed batch.
     *
     * Optional: connectors that do not support resumable pagination may omit this.
     * When absent (or returning undefined) cursor checkpointing is silently skipped.
     */
    getCursor?(): string | undefined;
}
