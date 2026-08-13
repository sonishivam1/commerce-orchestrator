import { Module } from '@nestjs/common';
import { CredentialResolver } from './credential.resolver';
import { CredentialService } from './credential.service';
import { EncryptionModule } from '../../common/encryption/encryption.module';

@Module({
    imports: [EncryptionModule],
    providers: [CredentialResolver, CredentialService],
})
export class CredentialModule { }
