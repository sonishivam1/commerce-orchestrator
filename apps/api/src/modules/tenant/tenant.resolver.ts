import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { TenantService } from './tenant.service';
import { TenantType } from './dto/tenant.type';
import { CreateTenantInput } from './dto/create-tenant.input';

@Resolver(() => TenantType)
export class TenantResolver {
    constructor(private readonly tenantService: TenantService) { }

    @Query(() => TenantType, { nullable: true, description: 'Get the current authenticated tenant profile.' })
    @UseGuards(GqlAuthGuard)
    me(@CurrentTenant() tenant: TenantContext) {
        return this.tenantService.getProfile(tenant.tenantId);
    }

    @Mutation(() => TenantType, { description: 'Register a new tenant (onboarding).' })
    createTenant(@Args('input') input: CreateTenantInput) {
        return this.tenantService.create(input);
    }
}
