import { IdentityTargetDecorator } from '../identity-target.decorator';
import { TargetConnector, LoadResult } from '@cdo/core';
import { IdentityMapRepository } from '@cdo/db';
import { EntityType } from '@cdo/shared';

describe('IdentityTargetDecorator', () => {
    let innerTarget: jest.Mocked<TargetConnector<any>>;
    let identityRepo: jest.Mocked<IdentityMapRepository>;
    let decorator: IdentityTargetDecorator;

    const TENANT_ID = 'tenant-123';
    const PROJECT_ID = 'proj-456';
    const ENTITY_TYPE = EntityType.PRODUCTS;
    const RUN_ID = 'run-789';

    beforeEach(() => {
        innerTarget = {
            initialize: jest.fn(),
            load: jest.fn(),
            getCapabilities: jest.fn().mockReturnValue({}),
        };

        identityRepo = {
            bulkUpsert: jest.fn(),
            getResolutionMap: jest.fn(),
        } as unknown as jest.Mocked<IdentityMapRepository>;

        decorator = new IdentityTargetDecorator(
            innerTarget,
            identityRepo,
            TENANT_ID,
            PROJECT_ID,
            ENTITY_TYPE,
            RUN_ID
        );
    });

    it('should delegate initialize() to inner connector', async () => {
        const credentials = { token: 'abc' };
        await decorator.initialize(credentials);
        expect(innerTarget.initialize).toHaveBeenCalledWith(credentials);
    });

    it('should persist successful results that have a targetId', async () => {
        const results: LoadResult[] = [
            { key: 'p1', success: true, targetId: 'gid://shopify/Product/1' },
            { key: 'p2', success: true, targetId: 'gid://shopify/Product/2' }
        ];

        innerTarget.load.mockResolvedValue(results);
        identityRepo.bulkUpsert.mockResolvedValue({ created: 2, updated: 0 });

        const actual = await decorator.load([]);

        expect(actual).toEqual(results); // Must return original LoadResult[] unchanged
        expect(identityRepo.bulkUpsert).toHaveBeenCalledWith([
            {
                tenantId: TENANT_ID,
                migrationProjectId: PROJECT_ID,
                entityType: ENTITY_TYPE,
                sourceKey: 'p1',
                targetId: 'gid://shopify/Product/1',
            },
            {
                tenantId: TENANT_ID,
                migrationProjectId: PROJECT_ID,
                entityType: ENTITY_TYPE,
                sourceKey: 'p2',
                targetId: 'gid://shopify/Product/2',
            }
        ]);
    });

    it('should not persist failed results or results without targetId', async () => {
        const results: LoadResult[] = [
            { key: 'p1', success: false, error: 'Failed' },
            { key: 'p2', success: true } // Success but no targetId (e.g. DryRun)
        ];

        innerTarget.load.mockResolvedValue(results);

        const actual = await decorator.load([]);

        expect(actual).toEqual(results);
        expect(identityRepo.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should propagate inner target errors', async () => {
        const error = new Error('Network error');
        innerTarget.load.mockRejectedValue(error);

        await expect(decorator.load([])).rejects.toThrow('Network error');
        expect(identityRepo.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should propagate persistence errors so migration fails visibly', async () => {
        const results: LoadResult[] = [
            { key: 'p1', success: true, targetId: 'gid://shopify/Product/1' }
        ];

        innerTarget.load.mockResolvedValue(results);
        
        const dbError = new Error('Database timeout');
        identityRepo.bulkUpsert.mockRejectedValue(dbError);

        await expect(decorator.load([])).rejects.toThrow('Database timeout');
    });
});
