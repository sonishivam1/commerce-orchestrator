import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ConnectionHealth } from '@cdo/shared';

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

    // ── Connection-level enrichment fields (Phase 1 addition) ────────────────
    // These are optional and absent on existing Credential documents — backward compatible.

    /**
     * Health state of this connection based on the last credential test.
     * Defaults to UNTESTED until the first test is run.
     */
    @Prop({
        type: String,
        enum: Object.values(ConnectionHealth),
        default: ConnectionHealth.UNTESTED,
    })
    health: string;

    /**
     * Platform capabilities this connection supports.
     * Populated after a discoverCapabilities() call. Empty array = not yet discovered.
     * Example: ['EXTRACT_PRODUCTS', 'EXTRACT_CATEGORIES', 'LOAD_PRODUCTS']
     */
    @Prop({ type: [String], default: [] })
    capabilities: string[];

    /**
     * Timestamp of the last successful credential test.
     * Null until the first test passes.
     */
    @Prop()
    lastTestedAt?: Date;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);
CredentialSchema.index({ tenantId: 1, platform: 1 });
CredentialSchema.index({ tenantId: 1, health: 1 });
