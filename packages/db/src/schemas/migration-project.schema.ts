/**
 * @file migration-project.schema.ts
 * @package @cdo/db
 *
 * A MigrationProject is the persistent, named configuration object that groups:
 *   - a source Connection (platform + credentials)
 *   - a target Connection
 *   - the entity types to migrate
 *   - field mapping configuration (v1: empty object; structured rules in later phases)
 *
 * A project can be executed multiple times — each execution produces a MigrationRun.
 * The IdentityMap is scoped per project, so repeated runs against the same project
 * reuse the existing source-key → target-id mappings (upsert, not recreate).
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MigrationProjectStatus } from '@cdo/shared';

export type MigrationProjectDocument = MigrationProject & Document;

@Schema({ timestamps: true, collection: 'migration_projects' })
export class MigrationProject {
    /** All queries MUST be scoped by tenantId — enforced at repository level */
    @Prop({ required: true, index: true })
    tenantId: string;

    /** Human-readable name for the project, e.g. "CT → Shopify Q3 Launch" */
    @Prop({ required: true })
    name: string;

    /**
     * Source platform connection — references the Credential (_id) in the credentials collection.
     * Named 'ConnectionId' to reflect the Connection concept even though the underlying document
     * is still a Credential in this phase.
     */
    @Prop({ required: true, index: true })
    sourceConnectionId: string;

    /**
     * Target platform connection — references the Credential (_id).
     */
    @Prop({ required: true, index: true })
    targetConnectionId: string;

    /**
     * Ordered list of entity types this project migrates.
     * The wave executor enforces dependency order; this list records intent.
     * Valid values match the EntityType enum: 'CATEGORIES' | 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS'.
     */
    @Prop({
        type: [String],
        enum: ['CATEGORIES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS'],
        required: true,
    })
    entityTypes: string[];

    /**
     * Field mapping and transformation rules for this project.
     * v1: free-form JSON object (empty by default).
     * Structured field-mapping DSL is deferred to a later phase.
     */
    @Prop({ type: Object, default: {} })
    mappingConfig: Record<string, unknown>;

    /**
     * Lifecycle status of the project.
     * DRAFT → configured but not yet run.
     * ACTIVE → has at least one completed run.
     * ARCHIVED → soft-deleted; excluded from default listings.
     */
    @Prop({
        type: String,
        enum: Object.values(MigrationProjectStatus),
        default: MigrationProjectStatus.DRAFT,
    })
    status: string;
}

export const MigrationProjectSchema = SchemaFactory.createForClass(MigrationProject);

// Primary tenant listing query
MigrationProjectSchema.index({ tenantId: 1, status: 1 });
MigrationProjectSchema.index({ tenantId: 1, createdAt: -1 });
