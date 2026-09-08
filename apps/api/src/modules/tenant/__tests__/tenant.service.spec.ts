import { TenantService } from '../tenant.service';
import { UserRole } from '@cdo/shared';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
// @ts-ignore
import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

describe('TenantService', () => {
    let service: TenantService;
    let tenantRepo: any;
    let userRepo: any;

    beforeEach(() => {
        tenantRepo = { create: jest.fn().mockResolvedValue({ _id: 'org-1', name: 'Acme' }) };
        userRepo = {
            findByEmail: jest.fn().mockResolvedValue(null),
            findById: jest.fn(),
            findAllForTenant: jest.fn().mockResolvedValue([]),
            findOneForTenant: jest.fn(),
            setStatus: jest.fn().mockResolvedValue(undefined),
            create: jest.fn(async (d: any) => ({ _id: 'user-1', status: 'active', ...d })),
        };
        service = new TenantService(tenantRepo, userRepo);
    });

    it('register() creates an organization and an OWNER user', async () => {
        const dto = await service.register({
            organizationName: 'Acme',
            name: 'Jane',
            email: 'jane@acme.com',
            password: 'supersecret',
        });

        expect(tenantRepo.create).toHaveBeenCalledWith({ name: 'Acme' });
        expect(userRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 'org-1', email: 'jane@acme.com', role: UserRole.OWNER }),
        );
        expect(dto.role).toBe(UserRole.OWNER);
    });

    it('register() rejects a duplicate email', async () => {
        userRepo.findByEmail.mockResolvedValueOnce({ _id: 'x' });
        await expect(
            service.register({ organizationName: 'A', name: 'B', email: 'dupe@x.com', password: 'x'.repeat(9) }),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('validateCredentials() returns the principal for a valid password', async () => {
        const passwordHash = await bcrypt.hash('hunter2xx', 4);
        userRepo.findByEmail.mockResolvedValueOnce({
            _id: 'user-9', tenantId: 'org-1', email: 'a@b.com', role: 'MEMBER', status: 'active', passwordHash,
        });

        const p = await service.validateCredentials('a@b.com', 'hunter2xx');
        expect(p).toEqual({ userId: 'user-9', tenantId: 'org-1', email: 'a@b.com', role: 'MEMBER' });
    });

    it('validateCredentials() rejects a disabled user', async () => {
        userRepo.findByEmail.mockResolvedValueOnce({ status: 'disabled', passwordHash: 'x' });
        await expect(service.validateCredentials('a@b.com', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('addMember() is owner-only', async () => {
        await expect(
            service.addMember('org-1', UserRole.MEMBER, { name: 'N', email: 'n@x.com', password: 'x'.repeat(9) }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
