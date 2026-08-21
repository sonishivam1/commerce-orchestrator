/**
 * @file reconciliation-report.schema.ts
 * @package @cdo/db
 *
 * A ReconciliationReport is generated at the end of a MigrationRun.
 * It compares what was in the source against what is now in the IdentityMap,
 * producing an actionable summary per entity type.
 *
 * Phase 1: Schema + repository only. Report generation logic lives in Phase 3.
 *
 * The report is immutable once created — it represents a point-in-time snapshot
 * of migration completeness. Re-running the migration produces a new report on the new run.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReconciliationReportDocument = ReconciliationReport & Document;

/** Per-entity-type reconciliation summary */
export interface EntityReconciliationSummary {
    /** Entity type this row covers: 'CATEGORIES' | 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS' */
    entityType: string;
    /** Count of entities found in the source during this run's extraction pass */
    sourceCount: number;
    /** Count of IdentityMap entries for this entity type in this project */
    migratedCount: number;
    /** Of the migratedCount, how many were new creates in the target */
    createdCount: number;
    /** Of the migratedCount, how many were updates to existing target records */
    updatedCount: number;
    /** Items that failed to load and ended up in the DLQ */
    failedCount: number;
    /**
     * Items where a cross-entity reference could not be resolved via IdentityMap.
     * Example: a Product references category key 'X', but 'X' has no IdentityMap entry.
     */
    missingRefCount: number;
}

@Schema({ timestamps: true, collection: 'reconciliation_reports' })
export class ReconciliationReport {
    /** All queries MUST be scoped by tenantId */
    @Prop({ required: true, index: true })
    tenantId: string;

    /** The MigrationRun this report was generated for — one report per run */
    @Prop({ required: true, index: true, unique: true })
    migrationRunId: string;

    /** The parent MigrationProject — for cross-run querying */
    @Prop({ required: true, index: true })
    migrationProjectId: string;

    /** When this report was computed */
    @Prop({ required: true })
    generatedAt: Date;

    /**
     * Overall success rate across all entity types: (migratedCount / sourceCount) * 100.
     * Rounded to 2 decimal places. 100.00 = perfect migration.
     */
    @Prop({ required: true })
    overallSuccessRate: number;

    /** Per-entity-type breakdown */
    @Prop({
        type: [
            {
                entityType: { type: String, required: true },
                sourceCount: { type: Number, default: 0 },
                migratedCount: { type: Number, default: 0 },
                createdCount: { type: Number, default: 0 },
                updatedCount: { type: Number, default: 0 },
                failedCount: { type: Number, default: 0 },
                missingRefCount: { type: Number, default: 0 },
            },
        ],
        default: [],
    })
    entitySummaries: EntityReconciliationSummary[];
}

export const ReconciliationReportSchema = SchemaFactory.createForClass(ReconciliationReport);

ReconciliationReportSchema.index({ tenantId: 1, migrationProjectId: 1, generatedAt: -1 });
