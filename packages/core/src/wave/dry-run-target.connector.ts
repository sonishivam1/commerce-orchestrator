import type { CanonicalEntity } from '@cdo/shared';
import type { TargetConnector, LoadResult } from '../interfaces/target.interface';

/**
 * DryRunTargetConnector — a no-op TargetConnector that suppresses all writes.
 *
 * When a MigrationRun has `dryRun=true`, the wave executor wraps the real target
 * connector in this class. The full extract + transform + validate path runs
 * identically; only the actual platform write is suppressed.
 *
 * `load()` returns a successful LoadResult for every item WITHOUT setting `targetId`,
 * so the wave executor correctly skips the IdentityMap write-back (no real ID was
 * assigned). This means dryRun produces accurate processedCount / failedCount but
 * leaves no IdentityMap entries.
 *
 * `getCapabilities()` delegates to the real connector so capability checks work
 * correctly during planning.
 */
export class DryRunTargetConnector<T extends CanonicalEntity> implements TargetConnector<T> {
    constructor(private readonly real: TargetConnector<T>) {}

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        // Initialize the real connector so any startup validation (auth, schema check)
        // still runs — the user gets realistic feedback about configuration.
        await this.real.initialize(credentials);
    }

    async load(batch: T[]): Promise<LoadResult[]> {
        // Return success for every item without hitting the platform.
        // targetId is intentionally absent — no IdentityMap entries are written.
        return batch.map((item) => ({
            key: item.key,
            success: true,
        }));
    }

    getCapabilities(): string[] {
        return this.real.getCapabilities();
    }
}
