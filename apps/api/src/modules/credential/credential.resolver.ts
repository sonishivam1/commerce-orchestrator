import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { CredentialService } from './credential.service';
import { CredentialType } from './dto/credential.type';
import { StoreCredentialInput } from './dto/store-credential.input';

@Resolver(() => CredentialType)
export class CredentialResolver {
    constructor(private readonly credentialService: CredentialService) { }

    @Query(() => [CredentialType], { description: 'List stored credentials for the current tenant.' })
    credentials() {
        return this.credentialService.findAll();
    }

    @Mutation(() => CredentialType, { description: 'Store a new encrypted platform credential.' })
    storeCredential(@Args('input') input: StoreCredentialInput) {
        return this.credentialService.store(input);
    }

    @Mutation(() => Boolean, { description: 'Delete a stored credential by ID.' })
    deleteCredential(@Args('id') id: string) {
        return this.credentialService.delete(id);
    }
}
