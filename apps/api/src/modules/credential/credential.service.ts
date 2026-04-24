import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { CredentialRepository } from '@cdo/db';
import { StoreCredentialInput } from './dto/store-credential.input';

/** AES-256-GCM produces a 16-byte auth tag */
const AUTH_TAG_LENGTH = 16;
/** AES-256-GCM uses a 12-byte IV (recommended per NIST) */
const IV_LENGTH = 12;
/** AES-256 requires 32-byte key → 64 hex chars */
const KEY_HEX_LENGTH = 64;

@Injectable()
export class CredentialService {
    constructor(private readonly credentialRepository: CredentialRepository) {}

    private getEncryptionKey(): Buffer {
        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== KEY_HEX_LENGTH) {
            throw new BadRequestException(
                'CREDENTIAL_KEY environment variable is not set or is invalid. Must be a 64-character hex string (32 bytes AES-256).'
            );
        }
        return Buffer.from(keyHex, 'hex');
    }

    private encrypt(plaintext: string): { encryptedPayload: string; iv: string; authTag: string } {
        const key = this.getEncryptionKey();
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encryptedPayload: encrypted,
            iv: iv.toString('hex'),
            authTag: cipher.getAuthTag().toString('hex'),
        };
    }

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

        const { encryptedPayload, iv, authTag } = this.encrypt(input.rawPayload);

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
        return this.credentialRepository.delete(tenantId, id);
    }
}
