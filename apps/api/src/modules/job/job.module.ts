import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { CredentialRepository } from '@cdo/db';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';

@Module({
    imports: [QueueModule],
    // CredentialRepository is @Global() via DatabaseModule; listed here for explicit DI documentation
    providers: [JobResolver, JobService, CredentialRepository],
})
export class JobModule { }
