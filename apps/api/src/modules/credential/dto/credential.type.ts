import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class CredentialType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field()
    platform: string;

    @Field()
    alias: string;

    @Field()
    createdAt: Date;

    @Field({ nullable: true })
    rawPayload?: string;

    // ── Connection enrichment fields (Phase 1) ────────────────────────────────
    // Existing credential documents will return default values for these fields.

    /**
     * Health state of this connection: UNTESTED | CONNECTED | DISCONNECTED | ERROR
     * Defaults to UNTESTED until credentials are explicitly tested.
     */
    @Field({ defaultValue: 'UNTESTED' })
    health: string;

    /**
     * Platform capabilities discovered for this connection.
     * Empty array until capabilities are discovered.
     * Example: ['EXTRACT_PRODUCTS', 'EXTRACT_CATEGORIES', 'LOAD_PRODUCTS']
     */
    @Field(() => [String], { defaultValue: [] })
    capabilities: string[];

    /** Timestamp of the last successful credential test, null if never tested */
    @Field({ nullable: true })
    lastTestedAt?: Date;
}
