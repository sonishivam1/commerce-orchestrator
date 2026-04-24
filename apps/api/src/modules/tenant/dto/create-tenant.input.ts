import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateTenantInput {
    @Field()
    name: string;

    @Field()
    email: string;

    @Field()
    password: string;
}
