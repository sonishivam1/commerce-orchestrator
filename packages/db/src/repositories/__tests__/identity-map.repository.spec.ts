import { IdentityMapRepository } from '../identity-map.repository';
import { EntityType } from '@cdo/shared';
// @ts-ignore
import { jest } from '@jest/globals';

describe('IdentityMapRepository', () => {
    let repository: IdentityMapRepository;
    let mockModel: any;

    beforeEach(() => {
        mockModel = {
            updateOne: jest.fn().mockResolvedValue({}),
            findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
        };
        repository = new IdentityMapRepository(mockModel);
    });

    it('should scope identity lookup to the execution identifier (jobId)', async () => {
        const tenantId = 't1';
        const jobId = 'job-123';
        const entityType = EntityType.PRODUCT;
        const sourceKey = 'src-abc';

        await repository.resolve(tenantId, jobId, entityType, sourceKey);

        expect(mockModel.findOne).toHaveBeenCalledWith({
            tenantId,
            jobId,
            entityType,
            sourceKey
        });
    });

    it('should allow two executions to contain mappings for the same source key without collision', async () => {
        const tenantId = 't1';
        const entityType = EntityType.PRODUCT;
        const sourceKey = 'src-abc';

        await repository.saveMapping(tenantId, 'job-A', entityType, sourceKey, 'target-123');
        await repository.saveMapping(tenantId, 'job-B', entityType, sourceKey, 'target-456');

        expect(mockModel.updateOne).toHaveBeenNthCalledWith(1,
            { tenantId, jobId: 'job-A', entityType, sourceKey },
            { $set: { targetId: 'target-123' } },
            { upsert: true }
        );

        expect(mockModel.updateOne).toHaveBeenNthCalledWith(2,
            { tenantId, jobId: 'job-B', entityType, sourceKey },
            { $set: { targetId: 'target-456' } },
            { upsert: true }
        );
    });
});
