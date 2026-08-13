import { Injectable, BadRequestException } from '@nestjs/common';
import { AesService } from '../../common/encryption/aes.service';
import { CredentialRepository } from '@cdo/db';
import { StoreCredentialInput } from './dto/store-credential.input';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly aesService: AesService,
    ) {}

    async findAll(tenantId: string) {
        // Repository strips encryptedPayload, iv, authTag at query level — safe to return directly
        return this.credentialRepository.findAllForTenant(tenantId);
    }

    async store(tenantId: string, input: StoreCredentialInput) {
        // Validate that rawPayload is valid JSON before encrypting
        try {
            JSON.parse(input.rawPayload);
        } catch {
            throw new BadRequestException('rawPayload must be a valid JSON string');
        }

        const { ciphertext, iv, authTag } = this.aesService.encrypt(input.rawPayload);

        return this.credentialRepository.create({
            tenantId,
            platform: input.platform,
            alias: input.alias,
            encryptedPayload: ciphertext,
            iv,
            authTag,
        });
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        return this.credentialRepository.delete(tenantId, id);
    }
}
