import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class RegisterInput {
    /** Organization display name. */
    @Field()
    organizationName: string;

    /** The first user's display name. */
    @Field()
    name: string;

    @Field()
    email: string;

    @Field()
    password: string;
}

@InputType()
export class AddMemberInput {
    @Field()
    name: string;

    @Field()
    email: string;

    @Field()
    password: string;
}
