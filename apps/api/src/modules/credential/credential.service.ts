import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CredentialRepository } from '@cdo/db';
import { AesService } from '../../common/encryption/aes.service';
import { StoreCredentialInput } from './dto/store-credential.input';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly aes: AesService,
    ) {}

    async findAll(tenantId: string) {
        // Repository strips encryptedPayload, iv, authTag — safe to return
        return this.credentialRepository.findAllForTenant(tenantId);
    }

    async store(tenantId: string, input: StoreCredentialInput) {
        // Validate rawPayload is parseable JSON before encrypting
        try {
            JSON.parse(input.rawPayload);
        } catch {
            throw new BadRequestException('rawPayload must be a valid JSON string');
        }

        const { encryptedPayload, iv, authTag } = this.aes.encrypt(input.rawPayload);

        return this.credentialRepository.create({
            tenantId,
            platform: input.platform,
            alias: input.alias,
            encryptedPayload,
            iv,
            authTag,
        });
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const deleted = await this.credentialRepository.delete(tenantId, id);
        if (!deleted) throw new NotFoundException(`Credential ${id} not found`);
        return true;
    }
}
