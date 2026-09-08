import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { TenantService } from './tenant.service';
import { TenantType } from './dto/tenant.type';
import { RegisterInput, AddMemberInput } from './dto/create-tenant.input';

@Resolver(() => TenantType)
export class TenantResolver {
    constructor(private readonly tenantService: TenantService) {}

    @Query(() => TenantType, { nullable: true, description: 'The current authenticated user.' })
    @UseGuards(GqlAuthGuard)
    me(@CurrentTenant() ctx: TenantContext) {
        return this.tenantService.getUser(ctx.userId);
    }

    @Query(() => [TenantType], { description: 'All users in the current organization.' })
    @UseGuards(GqlAuthGuard)
    organizationMembers(@CurrentTenant() ctx: TenantContext) {
        return this.tenantService.listMembers(ctx.tenantId);
    }

    @Mutation(() => TenantType, {
        description: 'Register a new organization and its first (owner) user.',
    })
    register(@Args('input') input: RegisterInput) {
        return this.tenantService.register(input);
    }

    @Mutation(() => TenantType, { description: 'Add a member to the organization (owner only).' })
    @UseGuards(GqlAuthGuard)
    addOrganizationMember(
        @Args('input') input: AddMemberInput,
        @CurrentTenant() ctx: TenantContext,
    ) {
        return this.tenantService.addMember(ctx.tenantId, ctx.role, input);
    }

    @Mutation(() => Boolean, { description: 'Enable or disable a member (owner only).' })
    @UseGuards(GqlAuthGuard)
    setMemberActive(
        @Args('userId', { type: () => ID }) userId: string,
        @Args('active') active: boolean,
        @CurrentTenant() ctx: TenantContext,
    ) {
        return this.tenantService.setMemberActive(ctx.tenantId, ctx.role, userId, active);
    }
}
