import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantRepository, UserRepository } from '@cdo/db';
import { UserRole } from '@cdo/shared';
import { RegisterInput, AddMemberInput } from './dto/create-tenant.input';

/** bcrypt cost factor — high enough to be secure, low enough not to block the event loop */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class TenantService {
    constructor(
        private readonly tenantRepository: TenantRepository,
        private readonly userRepository: UserRepository,
    ) {}

    // ── Current user ──────────────────────────────────────────────────────────

    async getUser(userId: string) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        return this.toDto(user);
    }

    // ── Registration ─────────────────────────────────────────────────────────

    /** Create an organization plus its first OWNER user. */
    async register(input: RegisterInput) {
        const existing = await this.userRepository.findByEmail(input.email);
        if (existing) {
            throw new ConflictException(`An account with email ${input.email} already exists`);
        }

        const org = await this.tenantRepository.create({ name: input.organizationName });
        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

        const owner = await this.userRepository.create({
            tenantId: String(org._id),
            email: input.email,
            passwordHash,
            name: input.name,
            role: UserRole.OWNER,
        });

        return this.toDto(owner);
    }

    // ── Login support ────────────────────────────────────────────────────────

    async validateCredentials(
        email: string,
        password: string,
    ): Promise<{ userId: string; tenantId: string; email: string; role: string }> {
        const user = await this.userRepository.findByEmail(email);
        if (!user || user.status !== 'active') {
            throw new UnauthorizedException('Invalid email or password');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return {
            userId: String(user._id),
            tenantId: user.tenantId,
            email: user.email,
            role: user.role,
        };
    }

    // ── Members (OWNER only) ─────────────────────────────────────────────────

    async listMembers(tenantId: string) {
        const users = await this.userRepository.findAllForTenant(tenantId);
        return users.map((u) => this.toDto(u));
    }

    async addMember(tenantId: string, actorRole: string, input: AddMemberInput) {
        this.assertOwner(actorRole);

        const existing = await this.userRepository.findByEmail(input.email);
        if (existing) {
            throw new ConflictException(`An account with email ${input.email} already exists`);
        }

        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        const member = await this.userRepository.create({
            tenantId,
            email: input.email,
            passwordHash,
            name: input.name,
            role: UserRole.MEMBER,
        });
        return this.toDto(member);
    }

    async setMemberActive(
        tenantId: string,
        actorRole: string,
        userId: string,
        active: boolean,
    ): Promise<boolean> {
        this.assertOwner(actorRole);
        const user = await this.userRepository.findOneForTenant(tenantId, userId);
        if (!user) throw new NotFoundException('Member not found');
        if (user.role === UserRole.OWNER) {
            throw new ForbiddenException('The organization owner cannot be disabled');
        }
        await this.userRepository.setStatus(tenantId, userId, active ? 'active' : 'disabled');
        return true;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private assertOwner(role: string): void {
        if (role !== UserRole.OWNER) {
            throw new ForbiddenException('Only the organization owner can manage members');
        }
    }

    private toDto(user: {
        _id: unknown;
        name: string;
        email: string;
        role: string;
        status: string;
        tenantId: string;
        createdAt?: Date;
    }) {
        return {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
            status: user.status,
            tenantId: user.tenantId,
            createdAt: user.createdAt ?? new Date(),
        };
    }
}
