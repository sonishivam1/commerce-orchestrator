import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    async login(email: string, password: string) {
        // TODO: Validate credentials against TenantRepository
        // TODO: Sign JWT token with tenantId payload
        return { accessToken: 'PLACEHOLDER_JWT', tenantId: 'PLACEHOLDER_TENANT_ID' };
    }

    async validateToken(token: string): Promise<{ tenantId: string } | null> {
        // TODO: Verify JWT signature, extract tenantId
        return null;
    }
}
