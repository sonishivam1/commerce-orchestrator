import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { CredentialRepository } from '@cdo/db';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';

/**
 * JobModule wires together the job resolver, service, and the queue producer.
 *
 * CredentialRepository is provided by DatabaseModule (@Global) so it does not
 * need to be listed here — it is automatically available to JobService via DI.
 * Listed explicitly for documentation purposes.
 */
@Module({
    imports:   [QueueModule],
    // CredentialRepository is @Global() via DatabaseModule; listed here for explicit DI documentation
    providers: [JobResolver, JobService, CredentialRepository],
})
export class JobModule {}
