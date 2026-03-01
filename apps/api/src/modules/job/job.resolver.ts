import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { JobService } from './job.service';
import { JobType } from './dto/job.type';
import { CreateJobInput } from './dto/create-job.input';

@Resolver(() => JobType)
export class JobResolver {
    constructor(private readonly jobService: JobService) { }

    @Query(() => [JobType], { description: 'List all jobs for the current tenant.' })
    jobs() {
        return this.jobService.findAll();
    }

    @Query(() => JobType, { nullable: true, description: 'Get a single job by ID.' })
    job(@Args('id') id: string) {
        return this.jobService.findOne(id);
    }

    @Mutation(() => JobType, { description: 'Enqueue a new ETL or Scrape job.' })
    createJob(@Args('input') input: CreateJobInput) {
        return this.jobService.create(input);
    }

    @Mutation(() => JobType, { description: 'Replay a failed item from the DLQ.' })
    replayJob(@Args('jobId') jobId: string, @Args('dlqItemId') dlqItemId: string) {
        return this.jobService.replayDlqItem(jobId, dlqItemId);
    }
}
