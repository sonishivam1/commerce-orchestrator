/**
 * @file migration-run.schema.ts
 * @package @cdo/db
 *
 * A MigrationRun is a single execution of a MigrationProject.
 * One project can have many runs (initial migration, delta runs, dry runs).
 *
 * Phase 1: Stores run-level counters and status.
 *          The waves[] array is a stub for Phase 2 (wave executor).
 *
 * Phase 2 will add:
 *   - waves[].cursor (source-specific continuation token for resume)
 *   - waves[].status transitions driven by the wave executor
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MigrationRunStatus, WaveStatus } from '@cdo/shared';

export type MigrationRunDocument = MigrationRun & Document;

/** Embedded record of one item that failed during a run. Replaces the DLQ collection. */
export interface FailedItem {
    entityType: string;
    /** Identifier of the item in the source platform (canonical key). */
    sourceId: string;
    reason: string;
    /** 'ValidationError' | 'TransientError' | 'FatalError' */
    errorType: string;
    occurredAt: Date;
}

/** Embedded wave-level execution record (one per entity type in the run) */
export interface WaveRecord {
    /** Entity type this wave processes: 'CATEGORIES' | 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS' */
    entityType: string;
    /** Current wave execution status */
    status: WaveStatus;
    /** Items successfully written to the target in this wave */
    processedCount: number;
    /** Items that failed to load in this wave */
    failedCount: number;
    /** ISO timestamp when this wave started processing */
    startedAt?: Date;
    /** ISO timestamp when this wave finished (success or failure) */
    completedAt?: Date;
    /**
     * Source-specific continuation cursor for resume.
     * Opaque value — meaning depends on the source connector's pagination API.
     * Null = wave has not started or started from the beginning.
     * Phase 2 populates and reads this field.
     */
    cursor?: string;
}

@Schema({ timestamps: true, collection: 'migration_runs' })
export class MigrationRun {
    /** All queries MUST be scoped by tenantId */
    @Prop({ required: true, index: true })
    tenantId: string;

    /** References MigrationProject._id */
    @Prop({ required: true, index: true })
    migrationProjectId: string;

    @Prop({
        type: String,
        enum: Object.values(MigrationRunStatus),
        default: MigrationRunStatus.PENDING,
    })
    status: string;

    /**
     * When true, this run validates and transforms but does not write to the target.
     * The same pipeline path runs; only target.load() is suppressed.
     */
    @Prop({ default: false })
    dryRun: boolean;

    /** Total items successfully written across all waves */
    @Prop({ default: 0 })
    processedCount: number;

    /** Total items that failed across all waves */
    @Prop({ default: 0 })
    failedCount: number;

    @Prop()
    startedAt?: Date;

    @Prop()
    completedAt?: Date;

    @Prop({ type: Object })
    errorSummary?: Record<string, unknown>;

    /**
     * Per-entity-type wave execution records.
     * Populated when the run starts; one entry per entity type in the project.
     * Phase 1: created as PENDING stubs when the run is initiated.
     * Phase 2: status/cursor/counts updated by the wave executor.
     */
    @Prop({
        type: [
            {
                entityType: { type: String, required: true },
                status: { type: String, enum: Object.values(WaveStatus), default: WaveStatus.PENDING },
                processedCount: { type: Number, default: 0 },
                failedCount: { type: Number, default: 0 },
                startedAt: { type: Date },
                completedAt: { type: Date },
                cursor: { type: String },
            },
        ],
        default: [],
    })
    waves: WaveRecord[];

    /**
     * Items that failed during the run. Embedded here instead of a separate
     * dead-letter-queue collection — the run detail page renders this list.
     */
    @Prop({
        type: [
            {
                entityType: { type: String, required: true },
                sourceId: { type: String, required: true },
                reason: { type: String, required: true },
                errorType: { type: String, required: true },
                occurredAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    failedItems: FailedItem[];

    /**
     * Request ID propagated through the BullMQ job and all log entries for this run.
     * Enables cross-system tracing.
     */
    @Prop()
    correlationId?: string;

    /** Retained alias for correlationId — some older callers still read traceId. */
    @Prop()
    traceId?: string;
}

export const MigrationRunSchema = SchemaFactory.createForClass(MigrationRun);

MigrationRunSchema.index({ tenantId: 1, migrationProjectId: 1, createdAt: -1 });
MigrationRunSchema.index({ tenantId: 1, status: 1 });
