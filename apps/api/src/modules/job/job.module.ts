import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';

/**
 * JobModule wires together the job resolver, service, and the queue producer.
 *
 * CredentialRepository is provided by DatabaseModule (@Global) and is
 * automatically available to JobService via DI — it must NOT be re-declared
 * here or NestJS will try to instantiate it locally without CredentialModel.
 */
@Module({
    imports:   [QueueModule],
    providers: [JobResolver, JobService],
})
export class JobModule {}
