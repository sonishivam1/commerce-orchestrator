/**
 * @file credential.decryptor.ts
 *
 * Standalone AES-256-GCM decryptor for the worker plane.
 * Not a NestJS service — instantiated directly so it can be used
 * before the DI container is ready (e.g., during job bootstrap).
 *
 * Reads CREDENTIAL_KEY from process.env at call time so workers
 * can rotate keys without restarting.
 */
import { createDecipheriv } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

const KEY_HEX_LENGTH = 64;

@Injectable()
export class CredentialDecryptor {
    private readonly logger = new Logger(CredentialDecryptor.name);

    decrypt(encryptedPayload: string, ivHex: string, authTagHex: string): Record<string, unknown> {
        const keyHex = process.env.CREDENTIAL_KEY;

        if (!keyHex || keyHex.length !== KEY_HEX_LENGTH) {
            // Dev fallback: allow unencrypted JSON during local development
            this.logger.warn(
                'CREDENTIAL_KEY missing or invalid — attempting raw JSON parse (dev mode only)',
            );
            try {
                return JSON.parse(encryptedPayload);
            } catch {
                throw new Error(
                    'CREDENTIAL_KEY is not configured and encryptedPayload is not raw JSON. Cannot decrypt credentials.',
                );
            }
        }

        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }
}
