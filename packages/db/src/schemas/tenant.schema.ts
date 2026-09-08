import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Tenant = the customer's organization. Users belong to one via `tenantId`.
 * `tenantId` (this document's _id) remains the data-scoping axis for every
 * other collection.
 */
export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
    /** Organization display name. */
    @Prop({ required: true })
    name: string;

    @Prop({ default: 'active', enum: ['active', 'suspended'] })
    status: string;

    createdAt?: Date;
    updatedAt?: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
