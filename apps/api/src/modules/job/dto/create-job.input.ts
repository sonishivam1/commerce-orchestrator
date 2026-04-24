import { InputType, Field } from '@nestjs/graphql';
import { JobKind } from './job.type';

@InputType()
export class PlatformCredentialInput {
    @Field()
    platform: string;

    @Field()
    encryptedPayload: string;
}

@InputType()
export class CreateJobInput {
    @Field(() => JobKind)
    kind: JobKind;

    @Field()
    sourceCredentialId: string;

    @Field({ nullable: true })
    targetCredentialId?: string;

    @Field({ nullable: true })
    sourceUrl?: string;
}
