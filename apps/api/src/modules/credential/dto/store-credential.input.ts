import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class StoreCredentialInput {
    @Field()
    platform: string;

    @Field()
    alias: string;

    @Field()
    rawPayload: string; // Will be encrypted before storage — never logged
}
