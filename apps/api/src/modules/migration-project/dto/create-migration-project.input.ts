import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateMigrationProjectInput {
    /** Human-readable name, e.g. "CT → Shopify Q3 Launch" */
    @Field()
    name: string;

    /** Credential ID to use as the source connection */
    @Field()
    sourceConnectionId: string;

    /** Credential ID to use as the target connection */
    @Field()
    targetConnectionId: string;

    /**
     * Entity types to migrate.
     * Must be a subset of: CATEGORIES, PRODUCTS, CUSTOMERS, ORDERS.
     * Order is ignored — the wave executor enforces dependency order.
     */
    @Field(() => [String])
    entityTypes: string[];
}

@InputType()
export class UpdateMigrationProjectInput {
    /** New display name (optional) */
    @Field({ nullable: true })
    name?: string;

    /**
     * Replacement mapping config as a JSON string (optional).
     * Pass the full config object — partial updates are not supported.
     */
    @Field({ nullable: true, description: 'JSON-serialised mapping configuration' })
    mappingConfig?: string;
}

@InputType()
export class CreateMigrationRunInput {
    /** The project to run */
    @Field()
    migrationProjectId: string;

    /**
     * When true, runs the full extract + transform + validate pipeline
     * but suppresses all writes to the target.
     */
    @Field({ defaultValue: false })
    dryRun: boolean;

    /**
     * B1 Resume: ID of a previous MigrationRun whose wave cursors should be inherited.
     *
     * When supplied, the new run is initialised with the cursor offsets from the
     * referenced run, so each wave resumes from where the previous run left off
     * rather than re-processing data from the beginning.
     *
     * Requirements:
     * - The referenced run must belong to the same tenant.
     * - The referenced run must belong to the same MigrationProject.
     * - The referenced run is left completely untouched (immutable audit record).
     *
     * This field is intentionally explicit (not automatic) so the operator can
     * decide when and from which run to resume.
     */
    @Field({ nullable: true })
    resumeFromRunId?: string;
}
