import { Module } from '@nestjs/common';
import { CredentialResolver } from './credential.resolver';
import { CredentialService } from './credential.service';

@Module({
    providers: [CredentialResolver, CredentialService],
})
export class CredentialModule { }
