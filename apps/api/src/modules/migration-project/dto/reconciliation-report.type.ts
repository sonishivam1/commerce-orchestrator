import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class EntityReconciliationSummaryType {
    @Field()
    entityType: string;

    @Field(() => Int)
    sourceCount: number;

    @Field(() => Int)
    migratedCount: number;

    @Field(() => Int)
    createdCount: number;

    @Field(() => Int)
    updatedCount: number;

    @Field(() => Int)
    failedCount: number;

    @Field(() => Int)
    missingRefCount: number;
}

@ObjectType()
export class ReconciliationReportType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field()
    migrationRunId: string;

    @Field()
    migrationProjectId: string;

    @Field()
    generatedAt: Date;

    /** 0–100, rounded to 2 decimal places */
    @Field(() => Float)
    overallSuccessRate: number;

    @Field(() => [EntityReconciliationSummaryType])
    entitySummaries: EntityReconciliationSummaryType[];
}
