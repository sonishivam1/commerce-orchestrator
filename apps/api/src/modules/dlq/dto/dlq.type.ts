import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class DlqItemType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field()
    jobId: string;

    @Field()
    itemKey: string;

    @Field()
    errorType: string;

    @Field()
    errorMessage: string;

    @Field({ nullable: true, description: 'JSON-serialised canonical payload for replay' })
    rawPayload?: string;

    @Field()
    canReplay: boolean;

    @Field()
    replayed: boolean;

    @Field({ nullable: true })
    replayedAt?: string;

    @Field()
    createdAt: string;
}
