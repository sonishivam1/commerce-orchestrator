import { IdentityMapRepository } from '../identity-map.repository';
import { EntityType } from '@cdo/shared';
// @ts-ignore
import { jest } from '@jest/globals';

describe('IdentityMapRepository', () => {
    let repository: IdentityMapRepository;
    let mockModel: any;

    beforeEach(() => {
        mockModel = {
            updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
            findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
            find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
            countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
            bulkWrite: jest.fn().mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 }),
        };
        repository = new IdentityMapRepository(mockModel);
    });

    describe('upsert()', () => {
        it('should scope the upsert to tenantId + migrationProjectId + entityType + sourceKey', async () => {
            await repository.upsert({
                tenantId: 't1',
                migrationProjectId: 'proj-1',
                entityType: EntityType.PRODUCTS,
                sourceKey: 'src-abc',
                targetId: 'target-123',
            });

            expect(mockModel.updateOne).toHaveBeenCalledWith(
                { tenantId: 't1', migrationProjectId: 'proj-1', entityType: EntityType.PRODUCTS, sourceKey: 'src-abc' },
                { $set: { targetId: 'target-123' } },
                { upsert: true },
            );
        });

        it('should allow two projects to contain mappings for the same source key without collision', async () => {
            await repository.upsert({ tenantId: 't1', migrationProjectId: 'proj-A', entityType: EntityType.PRODUCTS, sourceKey: 'src-abc', targetId: 'target-1' });
            await repository.upsert({ tenantId: 't1', migrationProjectId: 'proj-B', entityType: EntityType.PRODUCTS, sourceKey: 'src-abc', targetId: 'target-2' });

            expect(mockModel.updateOne).toHaveBeenNthCalledWith(1,
                { tenantId: 't1', migrationProjectId: 'proj-A', entityType: EntityType.PRODUCTS, sourceKey: 'src-abc' },
                { $set: { targetId: 'target-1' } },
                { upsert: true },
            );
            expect(mockModel.updateOne).toHaveBeenNthCalledWith(2,
                { tenantId: 't1', migrationProjectId: 'proj-B', entityType: EntityType.PRODUCTS, sourceKey: 'src-abc' },
                { $set: { targetId: 'target-2' } },
                { upsert: true },
            );
        });
    });

    describe('bulkUpsert()', () => {
        it('should return { created: 0, updated: 0 } for empty input without hitting the db', async () => {
            const result = await repository.bulkUpsert([]);
            expect(result).toEqual({ created: 0, updated: 0 });
            expect(mockModel.bulkWrite).not.toHaveBeenCalled();
        });

        it('should call bulkWrite and return upsertedCount as created, modifiedCount as updated', async () => {
            mockModel.bulkWrite.mockResolvedValue({ upsertedCount: 2, modifiedCount: 1 });

            const result = await repository.bulkUpsert([
                { tenantId: 't1', migrationProjectId: 'proj-1', entityType: EntityType.CATEGORIES, sourceKey: 'cat-1', targetId: 'gid-1' },
                { tenantId: 't1', migrationProjectId: 'proj-1', entityType: EntityType.CATEGORIES, sourceKey: 'cat-2', targetId: 'gid-2' },
            ]);

            expect(result).toEqual({ created: 2, updated: 1 });
            expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1);
        });
    });

    describe('findTargetId()', () => {
        it('should return null when no mapping exists', async () => {
            mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

            const result = await repository.findTargetId({
                tenantId: 't1', migrationProjectId: 'proj-1',
                entityType: EntityType.PRODUCTS, sourceKey: 'missing-key',
            });

            expect(result).toBeNull();
        });

        it('should return targetId when a mapping exists', async () => {
            mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ targetId: 'shopify-gid-999' }) });

            const result = await repository.findTargetId({
                tenantId: 't1', migrationProjectId: 'proj-1',
                entityType: EntityType.PRODUCTS, sourceKey: 'src-abc',
            });

            expect(result).toBe('shopify-gid-999');
        });
    });

    describe('getResolutionMap()', () => {
        it('should return an empty Map when no entries exist', async () => {
            const map = await repository.getResolutionMap('t1', 'proj-1', EntityType.CATEGORIES);
            expect(map.size).toBe(0);
        });

        it('should return a Map of sourceKey → targetId entries', async () => {
            mockModel.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { sourceKey: 'cat-a', targetId: 'gid://shopify/Collection/1' },
                        { sourceKey: 'cat-b', targetId: 'gid://shopify/Collection/2' },
                    ]),
                }),
            });

            const map = await repository.getResolutionMap('t1', 'proj-1', EntityType.CATEGORIES);

            expect(map.size).toBe(2);
            expect(map.get('cat-a')).toBe('gid://shopify/Collection/1');
            expect(map.get('cat-b')).toBe('gid://shopify/Collection/2');
        });
    });
});
