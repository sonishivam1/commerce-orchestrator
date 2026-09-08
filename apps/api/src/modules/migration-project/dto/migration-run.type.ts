import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { MigrationRunStatus, WaveStatus } from '@cdo/shared';

registerEnumType(MigrationRunStatus, { name: 'MigrationRunStatus' });
registerEnumType(WaveStatus, { name: 'WaveStatus' });

@ObjectType()
export class WaveRecordType {
    @Field()
    entityType: string;

    @Field(() => WaveStatus)
    status: WaveStatus;

    @Field(() => Int)
    processedCount: number;

    @Field(() => Int)
    failedCount: number;

    @Field({ nullable: true })
    startedAt?: Date;

    @Field({ nullable: true })
    completedAt?: Date;
}

@ObjectType()
export class FailedItemType {
    @Field()
    entityType: string;

    @Field()
    sourceId: string;

    @Field()
    reason: string;

    @Field()
    errorType: string;

    @Field({ nullable: true })
    occurredAt?: Date;
}

@ObjectType()
export class MigrationRunType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field()
    migrationProjectId: string;

    @Field(() => MigrationRunStatus)
    status: MigrationRunStatus;

    @Field()
    dryRun: boolean;

    @Field(() => Int)
    processedCount: number;

    @Field(() => Int)
    failedCount: number;

    @Field(() => [WaveRecordType])
    waves: WaveRecordType[];

    @Field(() => [FailedItemType])
    failedItems: FailedItemType[];

    @Field({ nullable: true })
    startedAt?: Date;

    @Field({ nullable: true })
    completedAt?: Date;

    @Field({ nullable: true })
    correlationId?: string;

    @Field()
    createdAt: Date;
}
