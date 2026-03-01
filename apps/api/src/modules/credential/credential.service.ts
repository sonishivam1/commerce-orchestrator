import { Injectable } from '@nestjs/common';
import { StoreCredentialInput } from './dto/store-credential.input';

@Injectable()
export class CredentialService {
    findAll() {
        // TODO: Query MongoDB CredentialRepository scoped by tenantId
        // NEVER return decrypted data — only metadata (platform, alias, createdAt)
        return [];
    }

    store(input: StoreCredentialInput) {
        // TODO: AES-256-GCM encrypt the raw credential payload before persisting
        return input;
    }

    delete(id: string) {
        // TODO: Delete credential document scoped by tenantId
        return true;
    }
}
