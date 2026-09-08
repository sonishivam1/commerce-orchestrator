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
        const { userId, tenantId, email: validatedEmail, role } =
            await this.tenantService.validateCredentials(email, password);

        const payload = { sub: userId, tenantId, email: validatedEmail, role };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken, tenantId };
    }

    async validateToken(token: string): Promise<{ tenantId: string; userId: string } | null> {
        try {
            const payload = this.jwtService.verify<{ sub: string; tenantId: string }>(token);
            return { tenantId: payload.tenantId, userId: payload.sub };
        } catch {
            return null;
        }
    }
}
