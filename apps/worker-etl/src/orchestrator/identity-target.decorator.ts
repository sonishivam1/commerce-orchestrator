import { TargetConnector, LoadResult } from '@cdo/core';
import { IdentityMapRepository } from '@cdo/db';
import { EntityType, CanonicalEntity } from '@cdo/shared';
import { Logger } from '@nestjs/common';

export class IdentityTargetDecorator<T extends CanonicalEntity = CanonicalEntity> implements TargetConnector<T> {
    private readonly logger = new Logger(IdentityTargetDecorator.name);

    constructor(
        private readonly inner: TargetConnector<T>,
        private readonly identityMapRepository: IdentityMapRepository,
        private readonly tenantId: string,
        private readonly migrationProjectId: string,
        private readonly entityType: EntityType,
        private readonly runId: string, // Used for logging
    ) {}

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        return this.inner.initialize(credentials);
    }

    getCapabilities(): string[] {
        if (typeof this.inner.getCapabilities === 'function') {
            return this.inner.getCapabilities();
        }
        return [];
    }

    async load(entities: T[]): Promise<LoadResult[]> {
        // Delegate to the inner connector
        const results = await this.inner.load(entities);

        // Filter successful results that have a targetId
        const succeeded = results.filter((r) => r.success && r.targetId);

        if (succeeded.length > 0) {
            const identityEntries = succeeded.map((r) => ({
                tenantId: this.tenantId,
                migrationProjectId: this.migrationProjectId,
                entityType: this.entityType,
                sourceKey: r.key,
                targetId: r.targetId!,
            }));

            try {
                const counts = await this.identityMapRepository.bulkUpsert(identityEntries);
                this.logger.log(
                    `[${this.runId}][${this.entityType}] IdentityMap +${counts.created} created / +${counts.updated} updated`,
                );
            } catch (error: any) {
                this.logger.error(
                    `[${this.runId}][${this.entityType}] Failed to persist IdentityMap entries: ${error.message}`,
                    error.stack,
                );
                // We re-throw because failing to persist identity maps silently corrupts the migration state
                // and downstream cross-entity references will fail to resolve.
                throw error;
            }
        }

        // Return the exact results produced by the inner target
        return results;
    }
}
