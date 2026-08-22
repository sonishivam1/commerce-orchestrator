/**
 * job.service.spec.ts
 *
 * Unit tests for JobService credential ownership validation.
 *
 * Mock strategy: all repository and producer dependencies are mocked via
 * jest.fn(). No real MongoDB or Redis connections are opened.
 *
 * Covered:
 *   [1] Source credential owned by requesting tenant → job created + enqueued
 *   [2] Source credential belongs to different tenant → ForbiddenException, no job, no enqueue
 *   [3] Source credential does not exist → ForbiddenException
 *   [4] Target credential belongs to different tenant → ForbiddenException, job NOT created
 *   [5] Both credentials valid and owned → job created and enqueued
 *   [6] SCRAPE_IMPORT (no sourceCredentialId) → only target ownership checked
 *   [7] replayDlqItem: stored credential now owned by another tenant → ForbiddenException, no re-enqueue
 *   [8] replayDlqItem: still-valid credentials → re-enqueued successfully
 *   [9] ForbiddenException thrown (not NotFoundException) — error does not reveal whether credential exists
 */

import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JobService } from '../job.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockJobRepository = {
    findAllForTenant: jest.fn(),
    findOneForTenant: jest.fn(),
    create:           jest.fn(),
    delete:           jest.fn(),
};

const mockDlqRepository = {
    findOneForTenant: jest.fn(),
    findAllForJob:    jest.fn(),
    markReplayed:     jest.fn(),
};

const mockJobProducer = {
    enqueueEtlJob:    jest.fn(),
    enqueueScrapeJob: jest.fn(),
};

const mockCredentialRepository = {
    findOneForTenant: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT       = 'tenant-a';
const OTHER_TENANT = 'tenant-b';

function buildService(): JobService {
    return new JobService(
        mockJobRepository       as any,
        mockDlqRepository       as any,
        mockJobProducer         as any,
        mockCredentialRepository as any,
    );
}

/** Minimal credential document owned by TENANT */
const ownedCred = (id: string) => ({
    _id: id, tenantId: TENANT, platform: 'SHOPIFY', alias: 'my-shop',
});

/** Minimal job document created in the happy path */
const fakeJobDoc = (id = 'job-1') => ({
    _id:               id,
    tenantId:          TENANT,
    kind:              'CROSS_PLATFORM_MIGRATION',
    status:            'PENDING',
    sourceCredentialId:'src-cred-1',
    targetCredentialId:'tgt-cred-1',
    entityTypes:       ['PRODUCTS'],
});

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    mockJobRepository.create.mockResolvedValue(fakeJobDoc());
    mockJobProducer.enqueueEtlJob.mockResolvedValue(undefined);
    mockJobProducer.enqueueScrapeJob.mockResolvedValue(undefined);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JobService.create() — credential ownership', () => {

    it('[1] source credential owned by requesting tenant → job created and enqueued', async () => {
        mockCredentialRepository.findOneForTenant
            .mockResolvedValueOnce(ownedCred('src-cred-1'))  // source check passes
            .mockResolvedValueOnce(ownedCred('tgt-cred-1')); // target check passes

        const svc = buildService();
        await expect(
            svc.create(TENANT, {
                kind:              'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId:'src-cred-1',
                targetCredentialId:'tgt-cred-1',
                entityTypes:       ['PRODUCTS'],
            } as any),
        ).resolves.toBeDefined();

        expect(mockJobRepository.create).toHaveBeenCalledTimes(1);
        expect(mockJobProducer.enqueueEtlJob).toHaveBeenCalledTimes(1);
    });

    it('[2] source credential belongs to different tenant → ForbiddenException, no job, no enqueue', async () => {
        // findOneForTenant scoped to TENANT returns null when credential belongs to OTHER_TENANT
        mockCredentialRepository.findOneForTenant.mockResolvedValueOnce(null);

        const svc = buildService();
        await expect(
            svc.create(TENANT, {
                kind:              'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId:'other-tenant-src',
                targetCredentialId:'tgt-cred-1',
                entityTypes:       ['PRODUCTS'],
            } as any),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(mockJobRepository.create).not.toHaveBeenCalled();
        expect(mockJobProducer.enqueueEtlJob).not.toHaveBeenCalled();
    });

    it('[3] source credential does not exist → ForbiddenException', async () => {
        mockCredentialRepository.findOneForTenant.mockResolvedValueOnce(null);

        const svc = buildService();
        await expect(
            svc.create(TENANT, {
                kind:              'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId:'nonexistent-cred',
                targetCredentialId:'tgt-cred-1',
                entityTypes:       ['PRODUCTS'],
            } as any),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(mockJobRepository.create).not.toHaveBeenCalled();
    });

    it('[4] target credential belongs to different tenant → ForbiddenException, job NOT created', async () => {
        mockCredentialRepository.findOneForTenant
            .mockResolvedValueOnce(ownedCred('src-cred-1'))  // source passes
            .mockResolvedValueOnce(null);                     // target fails

        const svc = buildService();
        await expect(
            svc.create(TENANT, {
                kind:              'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId:'src-cred-1',
                targetCredentialId:'other-tenant-tgt',
                entityTypes:       ['PRODUCTS'],
            } as any),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(mockJobRepository.create).not.toHaveBeenCalled();
        expect(mockJobProducer.enqueueEtlJob).not.toHaveBeenCalled();
    });

    it('[5] both credentials valid and owned → job created and enqueued', async () => {
        mockCredentialRepository.findOneForTenant
            .mockResolvedValueOnce(ownedCred('src-cred-1'))
            .mockResolvedValueOnce(ownedCred('tgt-cred-1'));

        const svc = buildService();
        const result = await svc.create(TENANT, {
            kind:              'CROSS_PLATFORM_MIGRATION',
            sourceCredentialId:'src-cred-1',
            targetCredentialId:'tgt-cred-1',
            entityTypes:       ['PRODUCTS', 'CATEGORIES'],
        } as any);

        expect(result).toBeDefined();
        expect(mockCredentialRepository.findOneForTenant).toHaveBeenCalledTimes(2);
        expect(mockJobRepository.create).toHaveBeenCalledTimes(1);
        expect(mockJobProducer.enqueueEtlJob).toHaveBeenCalledTimes(1);
    });

    it('[6] SCRAPE_IMPORT (no sourceCredentialId) → source ownership not checked, only target checked', async () => {
        // Only one credential lookup — for targetCredentialId
        mockCredentialRepository.findOneForTenant.mockResolvedValueOnce(ownedCred('tgt-cred-1'));
        mockJobRepository.create.mockResolvedValue({
            ...fakeJobDoc(),
            kind:              'SCRAPE_IMPORT',
            sourceUrl:         'https://example.com',
            sourceCredentialId: undefined,
        });

        const svc = buildService();
        await svc.create(TENANT, {
            kind:              'SCRAPE_IMPORT',
            sourceUrl:         'https://example.com',
            targetCredentialId:'tgt-cred-1',
        } as any);

        expect(mockCredentialRepository.findOneForTenant).toHaveBeenCalledTimes(1);
        expect(mockCredentialRepository.findOneForTenant).toHaveBeenCalledWith(TENANT, 'tgt-cred-1');
        expect(mockJobProducer.enqueueScrapeJob).toHaveBeenCalledTimes(1);
    });

    it('[9] ForbiddenException thrown — not NotFoundException', async () => {
        mockCredentialRepository.findOneForTenant.mockResolvedValueOnce(null);

        const svc = buildService();
        let thrown: unknown;
        try {
            await svc.create(TENANT, {
                kind:              'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId:'src-cred-1',
                targetCredentialId:'tgt-cred-1',
            } as any);
        } catch (err) {
            thrown = err;
        }

        expect(thrown).toBeInstanceOf(ForbiddenException);
        expect(thrown).not.toBeInstanceOf(NotFoundException);
    });
});

// ─── replayDlqItem ───────────────────────────────────────────────────────────

describe('JobService.replayDlqItem() — credential ownership re-validation', () => {

    const dlqItem = {
        _id:      'dlq-1',
        jobId:    'job-1',
        replayed: false,
        canReplay: true,
        tenantId: TENANT,
    };

    const parentJobEtl = {
        _id:               'job-1',
        tenantId:          TENANT,
        kind:              'CROSS_PLATFORM_MIGRATION',
        sourceCredentialId:'src-cred-1',
        targetCredentialId:'tgt-cred-1',
    };

    it('[7] stored source credential now owned by another tenant → ForbiddenException, no re-enqueue', async () => {
        mockDlqRepository.findOneForTenant.mockResolvedValueOnce(dlqItem);
        mockJobRepository.findOneForTenant.mockResolvedValueOnce(parentJobEtl);
        // source check: null → ForbiddenException
        mockCredentialRepository.findOneForTenant.mockResolvedValueOnce(null);

        const svc = buildService();
        await expect(
            svc.replayDlqItem(TENANT, 'job-1', 'dlq-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(mockJobProducer.enqueueEtlJob).not.toHaveBeenCalled();
        expect(mockDlqRepository.markReplayed).not.toHaveBeenCalled();
    });

    it('[8] stored credentials still valid → re-enqueued successfully', async () => {
        mockDlqRepository.findOneForTenant.mockResolvedValueOnce(dlqItem);
        mockJobRepository.findOneForTenant.mockResolvedValueOnce(parentJobEtl);
        mockCredentialRepository.findOneForTenant
            .mockResolvedValueOnce(ownedCred('src-cred-1'))  // source passes
            .mockResolvedValueOnce(ownedCred('tgt-cred-1')); // target passes
        mockDlqRepository.markReplayed.mockResolvedValue(undefined);

        const svc    = buildService();
        const result = await svc.replayDlqItem(TENANT, 'job-1', 'dlq-1');

        expect(result).toBeDefined();
        expect(mockJobProducer.enqueueEtlJob).toHaveBeenCalledTimes(1);
        expect(mockDlqRepository.markReplayed).toHaveBeenCalledWith('dlq-1');
    });
});
