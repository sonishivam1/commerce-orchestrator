import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum JobStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    PAUSED = 'PAUSED',
}

export enum JobKind {
    SCRAPE_IMPORT = 'SCRAPE_IMPORT',
    CROSS_PLATFORM_MIGRATION = 'CROSS_PLATFORM_MIGRATION',
    PLATFORM_CLONE = 'PLATFORM_CLONE',
    EXPORT = 'EXPORT',
}

export enum EntityType {
    PRODUCTS = 'PRODUCTS',
    CATEGORIES = 'CATEGORIES',
    CUSTOMERS = 'CUSTOMERS',
    ORDERS = 'ORDERS',
}

registerEnumType(JobStatus, { name: 'JobStatus' });
registerEnumType(JobKind, { name: 'JobKind' });
registerEnumType(EntityType, { name: 'EntityType' });

@ObjectType()
export class JobType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field(() => JobKind)
    kind: JobKind;

    @Field(() => JobStatus)
    status: JobStatus;

    @Field(() => [EntityType], { defaultValue: [EntityType.PRODUCTS] })
    entityTypes: EntityType[];

    @Field({ nullable: true })
    traceId?: string;

    @Field()
    createdAt: Date;

    @Field({ nullable: true })
    startedAt?: Date;

    @Field({ nullable: true })
    completedAt?: Date;

    @Field({ defaultValue: 0 })
    processedCount: number;

    @Field({ defaultValue: 0 })
    failedCount: number;

    @Field({ nullable: true })
    sourceCredentialId?: string;

    @Field({ nullable: true })
    targetCredentialId?: string;

    @Field({ nullable: true })
    sourceUrl?: string;

    /** Path to the exported file — only populated for EXPORT jobs that have completed. */
    @Field({ nullable: true })
    exportFilePath?: string;
}
