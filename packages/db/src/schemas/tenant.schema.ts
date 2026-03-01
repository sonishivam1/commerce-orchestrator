import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    passwordHash: string;

    @Prop({ default: 'active', enum: ['active', 'suspended'] })
    status: string;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
