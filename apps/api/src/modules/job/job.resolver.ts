import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { JobService } from './job.service';
import { JobType } from './dto/job.type';
import { CreateJobInput } from './dto/create-job.input';

@Resolver(() => JobType)
export class JobResolver {
    constructor(private readonly jobService: JobService) {}

    @Query(() => [JobType], { description: 'List all jobs for the current tenant.' })
    @UseGuards(GqlAuthGuard)
    jobs(@CurrentTenant() tenant: TenantContext) {
        return this.jobService.findAll(tenant.tenantId);
    }

    @Query(() => JobType, { nullable: true, description: 'Get a single job by ID.' })
    @UseGuards(GqlAuthGuard)
    job(@Args('id') id: string, @CurrentTenant() tenant: TenantContext) {
        return this.jobService.findOne(tenant.tenantId, id);
    }

    @Mutation(() => JobType, { description: 'Enqueue a new ETL or Scrape job.' })
    @UseGuards(GqlAuthGuard)
    createJob(
        @Args('input') input: CreateJobInput,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.jobService.create(tenant.tenantId, input);
    }

    @Mutation(() => Boolean, { description: 'Delete a job (only if not RUNNING).' })
    @UseGuards(GqlAuthGuard)
    deleteJob(
        @Args('id') id: string,
        @CurrentTenant() tenant: TenantContext,
    ): Promise<boolean> {
        return this.jobService.deleteJob(tenant.tenantId, id);
    }

    @Mutation(() => JobType, { description: 'Replay a failed item from the DLQ.' })
    @UseGuards(GqlAuthGuard)
    replayJob(
        @Args('jobId') jobId: string,
        @Args('dlqItemId') dlqItemId: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.jobService.replayDlqItem(tenant.tenantId, jobId, dlqItemId);
    }
}
