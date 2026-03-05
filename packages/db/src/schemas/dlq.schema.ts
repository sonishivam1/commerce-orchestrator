/**
 * @file dlq.schema.ts
 * @package @cdo/db
 *
 * Mongoose schema for Dead Letter Queue (DLQ) items.
 *
 * A DLQ item is created when a single entity (product, category, customer, order)
 * fails to load into the target platform after all retries are exhausted,
 * OR when it fails Zod validation (ValidationError — no retries attempted).
 *
 * The `rawPayload` field stores the serialised CanonicalEntity at the time of failure
 * so it can be replayed without re-extracting from the source.
 *
 * The `canReplay` flag marks items as eligible for the "Replay" action in the dashboard.
 * FATAL errors are not replayable — the entire job must be re-configured.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ErrorType } from '@cdo/shared';

export type DlqItemDocument = DlqItem & Document;

@Schema({ timestamps: true, collection: 'dlq_items' })
export class DlqItem {
    /** Which tenant this failed item belongs to — all queries MUST filter by this */
    @Prop({ required: true, index: true })
    tenantId: string;

    /** The job that produced this failure */
    @Prop({ required: true, index: true })
    jobId: string;

    /**
     * The canonical idempotency key of the entity that failed.
     * For products: the product key. For customers: the customer key.
     */
    @Prop({ required: true })
    itemKey: string;

    /**
     * Error classification:
     * - ValidationError → payload was structurally invalid, no retry
     * - TransientError  → network/rate-limit failure, retries exhausted
     */
    @Prop({
        required: true,
        enum: Object.values(ErrorType),
    })
    errorType: ErrorType;

    /** Human-readable error message from the caught exception */
    @Prop({ required: true })
    errorMessage: string;

    /**
     * Full serialised CanonicalEntity at the time of failure.
     * Used to replay the item without re-extracting from the source platform.
     */
    @Prop({ type: Object, required: true })
    rawPayload: Record<string, unknown>;

    /**
     * Whether this item can be replayed via the dashboard.
     * False for FatalError items — they require job-level intervention.
     */
    @Prop({ default: true })
    canReplay: boolean;

    /** Set to true once the item has been successfully replayed */
    @Prop({ default: false })
    replayed: boolean;

    /** Timestamp of when the item was successfully replayed (if replayed) */
    @Prop()
    replayedAt?: Date;
}

export const DlqItemSchema = SchemaFactory.createForClass(DlqItem);

// Index for dashboard queries: "show all DLQ items for this job in this tenant"
DlqItemSchema.index({ tenantId: 1, jobId: 1 });

// Index to efficiently find items eligible for bulk replay
DlqItemSchema.index({ tenantId: 1, canReplay: 1, replayed: 1 });
