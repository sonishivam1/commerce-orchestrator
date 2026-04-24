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
}
