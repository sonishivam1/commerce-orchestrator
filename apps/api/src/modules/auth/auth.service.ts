import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly tenantService: TenantService,
        private readonly jwtService: JwtService,
    ) {}

    async login(email: string, password: string) {
        // Delegates credential check to TenantService — AuthService must NOT query the DB directly
        const { tenantId, email: validatedEmail } = await this.tenantService.validateCredentials(email, password);

        const payload = { sub: tenantId, email: validatedEmail };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken, tenantId };
    }

    async validateToken(token: string): Promise<{ tenantId: string } | null> {
        try {
            const payload = this.jwtService.verify<{ sub: string }>(token);
            return { tenantId: payload.sub };
        } catch {
            return null;
        }
    }
}
