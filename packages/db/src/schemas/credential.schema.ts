import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CredentialDocument = Credential & Document;

@Schema({ timestamps: true, collection: 'credentials' })
export class Credential {
    @Prop({ required: true, index: true })
    tenantId: string;

    @Prop({ required: true })
    platform: string; // 'commercetools' | 'shopify' | 'bigcommerce'

    @Prop({ required: true })
    alias: string;

    @Prop({ required: true })
    encryptedPayload: string; // AES-256-GCM encrypted JSON

    @Prop({ required: true })
    iv: string; // Initialization vector for AES

    @Prop({ required: true })
    authTag: string; // Auth tag for AES-GCM verification
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);
CredentialSchema.index({ tenantId: 1, platform: 1 });
