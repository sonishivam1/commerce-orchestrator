import { Test, TestingModule } from '@nestjs/testing';
import { WaveExecutorService } from '../wave-executor.service';
import { IdentityMapRepository, MigrationRunRepository } from '@cdo/db';
import { EntityType, WaveStatus } from '@cdo/shared';
import type { SourceConnector, TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalCategory } from '@cdo/shared';

// Mock @cdo/connectors to avoid loading the real CT connector (which pulls in node-fetch ESM)
jest.mock('@cdo/connectors', () => ({
    ConnectorFactory: {
        createSource: jest.fn(),
        createTarget: jest.fn(),
    },
}));
// Import after mock declaration so the mock is in place
import { ConnectorFactory } from '@cdo/connectors';

/**
 * Golden path: a CT Category is extracted, Shopify returns a real collection ID,
 * and the IdentityMap is written with that mapping so a subsequent Products wave
 * can resolve the categoryKey → Shopify ID.
 */
describe('WaveExecutorService', () => {
    let service: WaveExecutorService;

    const mockIdentityMapRepo = {
        getResolutionMap: jest.fn(),
        bulkUpsert: jest.fn(),
        countForEntityType: jest.fn(),
    };
    const mockRunRepo = {
        updateWave: jest.fn(),
        appendFailedItem: jest.fn(),
    };

    // Mock source connector — yields one batch with one category
    const mockCategory: CanonicalCategory = {
        key: 'ct-electronics',
        name: { 'en-US': 'Electronics' },
        slug: { 'en-US': 'electronics' },
    } as unknown as CanonicalCategory;

    const mockSourceConnector: SourceConnector<CanonicalCategory> = {
        initialize: jest.fn().mockResolvedValue(undefined),
        async *extract() {
            yield [mockCategory];
        },
    };

    // Mock target connector — returns a Shopify collection ID
    const mockTargetConnector: TargetConnector<CanonicalCategory> = {
        initialize: jest.fn().mockResolvedValue(undefined),
        load: jest.fn().mockResolvedValue([
            {
                key: 'ct-electronics',
                success: true,
                targetId: 'gid://shopify/Collection/123',
            } as LoadResult,
        ]),
        getCapabilities: jest.fn().mockReturnValue(['upsert']),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        // Wire up the module-level mock
        (ConnectorFactory.createSource as jest.Mock).mockReturnValue(mockSourceConnector);
        (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(mockTargetConnector);

        mockIdentityMapRepo.getResolutionMap.mockResolvedValue(new Map());
        mockIdentityMapRepo.bulkUpsert.mockResolvedValue({ created: 1, updated: 0 });
        mockRunRepo.updateWave.mockResolvedValue(undefined);
        mockRunRepo.appendFailedItem.mockResolvedValue(undefined);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WaveExecutorService,
                { provide: IdentityMapRepository, useValue: mockIdentityMapRepo },
                { provide: MigrationRunRepository, useValue: mockRunRepo },
            ],
        }).compile();

        service = module.get<WaveExecutorService>(WaveExecutorService);
    });

    const baseConfig = {
        entityType: EntityType.CATEGORIES,
        plannedWaves: [EntityType.CATEGORIES, EntityType.PRODUCTS],
        run: {
            _id: 'run-001',
            tenantId: 'tenant-acme',
            migrationProjectId: 'proj-001',
            dryRun: false,
        },
        sourcePlatform: 'commercetools',
        targetPlatform: 'shopify',
        sourceCredentials: { clientId: 'ct-client' },
        targetCredentials: { accessToken: 'shpat-xxx' },
        context: {
            tenantId: 'tenant-acme',
            jobId: 'run-001',
            correlationId: 'corr-001',
            sourceCredentials: { clientId: 'ct-client' },
            targetCredentials: { accessToken: 'shpat-xxx' },
            migrationProjectId: 'proj-001',
            dryRun: false,
        },
    };

    describe('golden path — CT Category migrated → IdentityMap written', () => {
        it('calls bulkUpsert with the Shopify collection ID returned by the target connector', async () => {
            const stats = await service.executeWave(baseConfig);

            expect(mockIdentityMapRepo.bulkUpsert).toHaveBeenCalledWith([
                {
                    tenantId: 'tenant-acme',
                    migrationProjectId: 'proj-001',
                    entityType: EntityType.CATEGORIES,
                    sourceKey: 'ct-electronics',
                    targetId: 'gid://shopify/Collection/123',
                },
            ]);

            expect(stats.processedCount).toBe(1);
            expect(stats.failedCount).toBe(0);
        });

        it('marks wave RUNNING then COMPLETED', async () => {
            await service.executeWave(baseConfig);

            // First call should mark RUNNING
            expect(mockRunRepo.updateWave).toHaveBeenCalledWith('run-001', EntityType.CATEGORIES, expect.objectContaining({ status: WaveStatus.RUNNING }));
            // Final call should mark COMPLETED
            expect(mockRunRepo.updateWave).toHaveBeenCalledWith('run-001', EntityType.CATEGORIES, expect.objectContaining({ status: WaveStatus.COMPLETED }));
        });

        it('loads dependency resolution maps before running the wave', async () => {
            // CATEGORIES has no dependencies — should not call getResolutionMap for anything
            await service.executeWave(baseConfig);
            expect(mockIdentityMapRepo.getResolutionMap).not.toHaveBeenCalled();
        });

        it('loads CATEGORIES resolution map before running PRODUCTS wave', async () => {
            mockIdentityMapRepo.getResolutionMap.mockResolvedValue(
                new Map([['ct-electronics', 'gid://shopify/Collection/123']]),
            );

            await service.executeWave({
                ...baseConfig,
                entityType: EntityType.PRODUCTS,
            });

            expect(mockIdentityMapRepo.getResolutionMap).toHaveBeenCalledWith(
                'tenant-acme',
                'proj-001',
                EntityType.CATEGORIES,
            );

            // The resolution map is injected into target credentials under __identityMaps
            expect(mockTargetConnector.initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    __identityMaps: {
                        [EntityType.CATEGORIES]: { 'ct-electronics': 'gid://shopify/Collection/123' },
                    },
                }),
            );
        });
    });

    describe('dryRun — target.load() suppressed, IdentityMap not written', () => {
        it('does not call bulkUpsert when dryRun=true', async () => {
            await service.executeWave({
                ...baseConfig,
                run: { ...baseConfig.run, dryRun: true },
                context: { ...baseConfig.context, dryRun: true },
            });

            // DryRunTargetConnector returns results with no targetId, so bulkUpsert should
            // not be called (the filter `r.targetId` excludes all results)
            expect(mockIdentityMapRepo.bulkUpsert).not.toHaveBeenCalled();
        });

        it('still counts processed items in dryRun mode', async () => {
            const stats = await service.executeWave({
                ...baseConfig,
                run: { ...baseConfig.run, dryRun: true },
                context: { ...baseConfig.context, dryRun: true },
            });

            // Items are processed (extract + transform) but not written
            expect(stats.processedCount).toBe(1);
        });
    });

    describe('wave failure — propagates error and marks wave FAILED', () => {
        it('marks the wave FAILED and re-throws when the engine crashes', async () => {
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue({
                initialize: jest.fn().mockRejectedValue(new Error('Shopify auth failed')),
                load: jest.fn(),
                getCapabilities: jest.fn().mockReturnValue([]),
            });

            await expect(service.executeWave(baseConfig)).rejects.toThrow('Shopify auth failed');

            expect(mockRunRepo.updateWave).toHaveBeenCalledWith(
                'run-001',
                EntityType.CATEGORIES,
                expect.objectContaining({ status: WaveStatus.FAILED }),
            );
        });
    });
});
