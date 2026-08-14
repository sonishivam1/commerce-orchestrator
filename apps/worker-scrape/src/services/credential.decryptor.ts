/**
 * @file credential.decryptor.ts
 * Identical to the ETL worker's decryptor — separated to keep each worker
 * independently deployable without cross-worker package imports.
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
            this.logger.warn(
                'CREDENTIAL_KEY missing — attempting raw JSON parse (dev mode only)',
            );
            try {
                return JSON.parse(encryptedPayload);
            } catch {
                throw new Error('Cannot decrypt credentials: CREDENTIAL_KEY not configured.');
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
