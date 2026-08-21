import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IdentityMap, IdentityMapDocument } from '../schemas/identity-map.schema';

@Injectable()
export class IdentityMapRepository {
    constructor(
        @InjectModel(IdentityMap.name)
        private readonly model: Model<IdentityMapDocument>,
    ) {}

    /**
     * Upsert a single source → target mapping.
     * If an entry already exists for (tenantId, migrationProjectId, entityType, sourceKey),
     * its targetId is updated. This supports both first-run creates and delta-run updates.
     */
    async upsert(data: {
        tenantId: string;
        migrationProjectId: string;
        entityType: string;
        sourceKey: string;
        targetId: string;
    }): Promise<void> {
        await this.model
            .updateOne(
                {
                    tenantId: data.tenantId,
                    migrationProjectId: data.migrationProjectId,
                    entityType: data.entityType,
                    sourceKey: data.sourceKey,
                },
                { $set: { targetId: data.targetId } },
                { upsert: true },
            )
            .exec();
    }

    /**
     * Bulk upsert — more efficient than calling upsert() in a loop.
     * Uses bulkWrite with individual upsert operations.
     *
     * Returns the count of newly created entries and updated entries so the
     * wave executor can build accurate ReconciliationReport statistics.
     */
    async bulkUpsert(
        entries: {
            tenantId: string;
            migrationProjectId: string;
            entityType: string;
            sourceKey: string;
            targetId: string;
        }[],
    ): Promise<{ created: number; updated: number }> {
        if (entries.length === 0) return { created: 0, updated: 0 };

        const ops = entries.map((entry) => ({
            updateOne: {
                filter: {
                    tenantId: entry.tenantId,
                    migrationProjectId: entry.migrationProjectId,
                    entityType: entry.entityType,
                    sourceKey: entry.sourceKey,
                },
                update: { $set: { targetId: entry.targetId } },
                upsert: true,
            },
        }));

        const result = await this.model.bulkWrite(ops);
        return {
            created: result.upsertedCount,
            updated: result.modifiedCount,
        };
    }

    /**
     * Look up the target ID for a given source key.
     * Returns null when no mapping exists (entity not yet migrated or never migrated).
     */
    async findTargetId(data: {
        tenantId: string;
        migrationProjectId: string;
        entityType: string;
        sourceKey: string;
    }): Promise<string | null> {
        const entry = await this.model
            .findOne(
                {
                    tenantId: data.tenantId,
                    migrationProjectId: data.migrationProjectId,
                    entityType: data.entityType,
                    sourceKey: data.sourceKey,
                },
                { targetId: 1 },
            )
            .exec();
        return entry?.targetId ?? null;
    }

    /**
     * Count how many entries exist for a given entity type within a project.
     * Used by the reconciliation report generator to produce the migratedCount.
     */
    async countForEntityType(
        tenantId: string,
        migrationProjectId: string,
        entityType: string,
    ): Promise<number> {
        return this.model
            .countDocuments({ tenantId, migrationProjectId, entityType })
            .exec();
    }

    /**
     * Return all mappings for a given entity type in a project.
     * Used for cross-entity reference resolution (e.g. Category sourceKey → targetId).
     * Returns a plain Map<sourceKey, targetId> for O(1) lookup during load.
     */
    async getResolutionMap(
        tenantId: string,
        migrationProjectId: string,
        entityType: string,
    ): Promise<Map<string, string>> {
        const entries = await this.model
            .find({ tenantId, migrationProjectId, entityType }, { sourceKey: 1, targetId: 1 })
            .lean()
            .exec();

        const map = new Map<string, string>();
        for (const entry of entries) {
            map.set(entry.sourceKey, entry.targetId);
        }
        return map;
    }
}
