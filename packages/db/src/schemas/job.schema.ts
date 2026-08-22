import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobDocument = Job & Document;

@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
    @Prop({ required: true, index: true })
    tenantId: string;

    @Prop({ required: true, enum: ['SCRAPE_IMPORT', 'CROSS_PLATFORM_MIGRATION', 'PLATFORM_CLONE', 'EXPORT'] })
    kind: string;

    @Prop({ required: true, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED'], default: 'PENDING' })
    status: string;

    @Prop()
    traceId?: string;

    @Prop()
    correlationId?: string;

    @Prop()
    sourceCredentialId?: string;

    @Prop()
    targetCredentialId?: string;

    @Prop()
    sourceUrl?: string;

    /**
     * Entity types this job should migrate.
     * Defaults to ['PRODUCTS'] for backward compatibility with existing jobs.
     */
    @Prop({ type: [String], enum: ['PRODUCTS', 'CATEGORIES', 'CUSTOMERS', 'ORDERS'], default: ['PRODUCTS'] })
    entityTypes: string[];

    @Prop({ default: 0 })
    processedCount: number;

    @Prop({ default: 0 })
    failedCount: number;

    @Prop()
    startedAt?: Date;

    @Prop()
    completedAt?: Date;

    @Prop({ type: Object })
    errorSummary?: Record<string, unknown>;

    /** Absolute path to the exported JSONL file — set by EXPORT jobs on completion. */
    @Prop()
    exportFilePath?: string;

    // ── MigrationProject linkage (Phase 1 addition) ──────────────────────────
    // Absent on legacy jobs — backward compatible (no default needed).

    /**
     * The MigrationProject this job was initiated from.
     * When present, the orchestrator writes IdentityMap entries keyed by this project.
     * Absent on jobs created via the legacy Job API.
     */
    @Prop({ index: true })
    migrationProjectId?: string;

    /**
     * When true, the ETL pass validates and transforms but does not write to the target.
     * Defaults to false for all legacy jobs.
     */
    @Prop({ default: false })
    dryRun: boolean;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Ensure all queries are scoped by tenantId
JobSchema.index({ tenantId: 1, status: 1 });
JobSchema.index({ tenantId: 1, createdAt: -1 });
