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

    @Prop({ default: 0 })
    processedCount: number;

    @Prop({ default: 0 })
    failedCount: number;

    @Prop()
    completedAt?: Date;

    @Prop({ type: Object })
    errorSummary?: Record<string, unknown>;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Ensure all queries are scoped by tenantId
JobSchema.index({ tenantId: 1, status: 1 });
JobSchema.index({ tenantId: 1, createdAt: -1 });
