import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { DlqService } from './dlq.service';
import { DlqItemType } from './dto/dlq.type';

@Resolver(() => DlqItemType)
export class DlqResolver {
    constructor(private readonly dlqService: DlqService) {}

    @Query(() => [DlqItemType], { description: 'List DLQ items for a specific job.' })
    @UseGuards(GqlAuthGuard)
    dlqItems(
        @Args('jobId') jobId: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.dlqService.findAllForJob(tenant.tenantId, jobId);
    }

    @Query(() => Int, { description: 'Count of un-replayed DLQ items for a job.' })
    @UseGuards(GqlAuthGuard)
    dlqPendingCount(
        @Args('jobId') jobId: string,
        @CurrentTenant() tenant: TenantContext,
    ): Promise<number> {
        return this.dlqService.countPending(tenant.tenantId, jobId);
    }

    @Mutation(() => Boolean, { description: 'Delete a DLQ item (non-replayable cleanup).' })
    @UseGuards(GqlAuthGuard)
    deleteDlqItem(
        @Args('id') id: string,
        @CurrentTenant() tenant: TenantContext,
    ): Promise<boolean> {
        return this.dlqService.delete(tenant.tenantId, id);
    }
}
