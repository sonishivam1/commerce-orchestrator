import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TenantRepository } from '@cdo/db';
import { CreateTenantInput } from './dto/create-tenant.input';

/** bcrypt cost factor — high enough to be secure, low enough not to block the event loop */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class TenantService {
    constructor(
        private readonly tenantRepository: TenantRepository,
        private readonly jwtService: JwtService,
    ) {}

    async getProfile(tenantId: string) {
        return this.tenantRepository.findById(tenantId);
    }

    async create(input: CreateTenantInput) {
        const existing = await this.tenantRepository.findByEmail(input.email);
        if (existing) {
            throw new ConflictException(`An account with email ${input.email} already exists`);
        }

        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

        const tenant = await this.tenantRepository.create({
            name: input.name,
            email: input.email,
            passwordHash,
        });

        return tenant;
    }

    async validateCredentials(email: string, password: string): Promise<{ tenantId: string; email: string }> {
        const tenant = await this.tenantRepository.findByEmail(email);

        if (!tenant) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const isValid = await bcrypt.compare(password, tenant.passwordHash);

        if (!isValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return { tenantId: String(tenant._id), email: tenant.email };
    }
}
