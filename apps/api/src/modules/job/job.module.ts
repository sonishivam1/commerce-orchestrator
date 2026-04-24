import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';

@Module({
    imports: [QueueModule],
    providers: [JobResolver, JobService],
})
export class JobModule { }
