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

    /** Required for ETL jobs (CROSS_PLATFORM_MIGRATION, PLATFORM_CLONE, EXPORT). */
    @Field({ nullable: true })
    sourceCredentialId?: string;

    /** Required for ETL jobs; for EXPORT, acts as the data-source credential. */
    @Field({ nullable: true })
    targetCredentialId?: string;

    /** Required for SCRAPE_IMPORT jobs. */
    @Field({ nullable: true })
    sourceUrl?: string;
}
