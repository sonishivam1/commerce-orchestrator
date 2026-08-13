import { Module } from '@nestjs/common';
import { CredentialResolver } from './credential.resolver';
import { CredentialService } from './credential.service';
import { AesService } from '../../common/encryption/aes.service';

@Module({
    providers: [CredentialResolver, CredentialService, AesService],
})
export class CredentialModule {}
