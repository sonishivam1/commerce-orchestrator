import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { JobService } from './job.service';
import { JobType } from './dto/job.type';
import { CreateJobInput } from './dto/create-job.input';
// We'll need a DLQ type for the query
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
class DlqType {
    @Field()
    id: string;
    @Field()
    itemKey: string;
    @Field()
    errorType: string;
    @Field()
    errorMessage: string;
    @Field({ nullable: true })
    rawPayload?: string; // JSON string
}

@Resolver(() => JobType)
export class JobResolver {
    constructor(private readonly jobService: JobService) { }

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

    @Query(() => [DlqType], { description: 'List DLQ items for a specific job.' })
    @UseGuards(GqlAuthGuard)
    dlqItems(@Args('jobId') jobId: string, @CurrentTenant() tenant: TenantContext) {
        return this.jobService.findDlqItems(tenant.tenantId, jobId);
    }

    @Mutation(() => JobType, { description: 'Enqueue a new ETL or Scrape job.' })
    @UseGuards(GqlAuthGuard)
    createJob(@Args('input') input: CreateJobInput, @CurrentTenant() tenant: TenantContext) {
        return this.jobService.create(tenant.tenantId, input);
    }

    @Mutation(() => JobType, { description: 'Replay a failed item from the DLQ.' })
    @UseGuards(GqlAuthGuard)
    replayJob(
        @Args('jobId') jobId: string,
        @Args('dlqItemId') dlqItemId: string,
        @CurrentTenant() tenant: TenantContext
    ) {
        return this.jobService.replayDlqItem(tenant.tenantId, jobId, dlqItemId);
    }
}
