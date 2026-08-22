/**
 * @file identity-map.schema.ts
 * @package @cdo/db
 *
 * The IdentityMap persists the source-key → target-id mapping for every entity
 * successfully written during a migration. It is the bridge between two systems' identities.
 *
 * Scope: per-project (not per-run). This means:
 *   - If a project runs twice, the second run reuses existing entries (upsert, not recreate).
 *   - Cross-entity references (e.g. a Product referencing a Category's sourceKey) are
 *     resolved through this map — no guessing of target IDs.
 *
 * Example entry:
 *   tenantId:           'tenant-abc'
 *   migrationProjectId: 'proj-123'
 *   entityType:         'CATEGORIES'
 *   sourceKey:          'ct-category-mens-shoes'
 *   targetId:           'gid://shopify/Collection/456789'
 *
 * Upsert semantics:
 *   The orchestrator uses the unique compound index to upsert entries.
 *   On re-run, targetId may change if the target was recreated — the map is updated.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IdentityMapDocument = IdentityMap & Document;

@Schema({ timestamps: true, collection: 'identity_maps' })
export class IdentityMap {
    /** All queries MUST be scoped by tenantId */
    @Prop({ required: true, index: true })
    tenantId: string;

    /**
     * The MigrationProject this mapping belongs to.
     * Scoping by project (not by run) enables incremental sync across multiple runs.
     */
    @Prop({ required: true, index: true })
    migrationProjectId: string;

    /**
     * Entity type: 'CATEGORIES' | 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS'
     * Matches the EntityType enum values from @cdo/shared.
     */
    @Prop({
        required: true,
        type: String,
        enum: ['CATEGORIES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS'],
    })
    entityType: string;

    /**
     * The canonical idempotency key from the source platform.
     * For CT products: the product key. For CT categories: the category key.
     * For Shopify products: the handle or GID. Must be stable across runs.
     */
    @Prop({ required: true })
    sourceKey: string;

    /**
     * The ID assigned by the target platform after a successful write.
     * For Shopify: GID (e.g. 'gid://shopify/Product/123').
     * For CT: the UUID or key assigned on creation.
     */
    @Prop({ required: true })
    targetId: string;
}

export const IdentityMapSchema = SchemaFactory.createForClass(IdentityMap);

/**
 * Primary lookup index — used to resolve a sourceKey → targetId during load.
 * UNIQUE: one source entity maps to exactly one target entity per project.
 * This index enforces the upsert guarantee.
 */
IdentityMapSchema.index(
    { tenantId: 1, migrationProjectId: 1, entityType: 1, sourceKey: 1 },
    { unique: true },
);

/** Secondary index for bulk-listing all entries of a given entity type in a project */
IdentityMapSchema.index({ tenantId: 1, migrationProjectId: 1, entityType: 1 });
