/**
 * @file aes.service.ts
 *
 * Reusable AES-256-GCM encryption/decryption service.
 * Reads CREDENTIAL_KEY from the environment; validates length on startup.
 * Used by both the API (CredentialService) and Workers (CredentialDecryptor).
 */
import { Injectable, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/** AES-256-GCM produces a 16-byte auth tag */
const AUTH_TAG_LENGTH = 16;
/** AES-256-GCM uses a 12-byte IV (recommended per NIST) */
const IV_LENGTH = 12;
/** AES-256 requires 32-byte key → 64 hex chars */
const KEY_HEX_LENGTH = 64;

export interface EncryptResult {
    encryptedPayload: string;
    iv: string;
    authTag: string;
}

@Injectable()
export class AesService implements OnApplicationBootstrap {
    onApplicationBootstrap() {
        // Fail fast: if the key is not set, refuse to start rather than silently encrypting nothing
        this.getKey();
    }

    private getKey(): Buffer {
        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== KEY_HEX_LENGTH) {
            throw new BadRequestException(
                'CREDENTIAL_KEY env var is missing or invalid. Must be exactly 64 hex chars (32 bytes for AES-256).',
            );
        }
        return Buffer.from(keyHex, 'hex');
    }

    encrypt(plaintext: string): EncryptResult {
        const key = this.getKey();
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

    decrypt(encryptedPayload: string, ivHex: string, authTagHex: string): string {
        const key = this.getKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    decryptToObject(encryptedPayload: string, ivHex: string, authTagHex: string): Record<string, unknown> {
        const json = this.decrypt(encryptedPayload, ivHex, authTagHex);
        return JSON.parse(json);
    }
}
