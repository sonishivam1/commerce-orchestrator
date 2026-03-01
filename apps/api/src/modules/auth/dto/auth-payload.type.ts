import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class AuthPayloadType {
    @Field()
    accessToken: string;

    @Field()
    tenantId: string;
}
