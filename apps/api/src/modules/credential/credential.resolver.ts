import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { CredentialService } from './credential.service';
import { CredentialType } from './dto/credential.type';
import { StoreCredentialInput } from './dto/store-credential.input';

@Resolver(() => CredentialType)
export class CredentialResolver {
    constructor(private readonly credentialService: CredentialService) { }

    @Query(() => [CredentialType], { description: 'List stored credentials for the current tenant.' })
    @UseGuards(GqlAuthGuard)
    credentials(@CurrentTenant() tenant: TenantContext) {
        return this.credentialService.findAll(tenant.tenantId);
    }

    @Mutation(() => CredentialType, { description: 'Store a new encrypted platform credential.' })
    @UseGuards(GqlAuthGuard)
    storeCredential(
        @Args('input') input: StoreCredentialInput,
        @CurrentTenant() tenant: TenantContext
    ) {
        return this.credentialService.store(tenant.tenantId, input);
    }

    @Mutation(() => Boolean, { description: 'Delete a stored credential by ID.' })
    @UseGuards(GqlAuthGuard)
    deleteCredential(
        @Args('id') id: string,
        @CurrentTenant() tenant: TenantContext
    ) {
        return this.credentialService.delete(tenant.tenantId, id);
    }
}
