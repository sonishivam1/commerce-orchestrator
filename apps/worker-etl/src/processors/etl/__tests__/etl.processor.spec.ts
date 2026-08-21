import { EtlProcessor } from '../etl.processor';
import { EntityType } from '@cdo/shared';
// @ts-ignore
import { jest } from '@jest/globals';

describe('EtlProcessor', () => {
    let processor: EtlProcessor;
    let mockCredRepo: any;
    let mockJobRepo: any;
    let mockOrchestrator: any;
    let mockDecryptor: any;
    let mockLockService: any;
    let mockIdentityRepo: any;

    beforeEach(() => {
        mockCredRepo = {
            findOneDecrypted: jest.fn().mockResolvedValue({ encryptedPayload: '', iv: '', authTag: '', platform: 'commercetools' })
        };
        mockJobRepo = {
            markRunning: jest.fn().mockResolvedValue(undefined)
        };
        mockOrchestrator = {
            execute: jest.fn().mockResolvedValue(undefined)
        };
        mockDecryptor = {
            decrypt: jest.fn().mockReturnValue({})
        };
        mockLockService = {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined)
        };
        mockIdentityRepo = {};

        processor = new EtlProcessor(
            mockCredRepo,
            mockJobRepo,
            mockOrchestrator,
            mockDecryptor,
            mockLockService,
            mockIdentityRepo
        );
    });

    it('existing Product migration remains compatible (defaults to PRODUCT if entityType is missing)', async () => {
        const job: any = {
            id: 'job-1',
            data: {
                tenantId: 't1',
                jobId: 'job-1',
                kind: 'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId: 'sc1',
                targetCredentialId: 'tc1'
                // Notice: no entityType provided!
            }
        };

        await processor.process(job);

        expect(mockOrchestrator.execute).toHaveBeenCalled();
        const executeCall = mockOrchestrator.execute.mock.calls[0][0];
        expect(executeCall.context.entityType).toBe(EntityType.PRODUCT);
    });

    it('respects explicitly provided entityType', async () => {
        const job: any = {
            id: 'job-1',
            data: {
                tenantId: 't1',
                jobId: 'job-1',
                kind: 'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId: 'sc1',
                targetCredentialId: 'tc1',
                entityType: EntityType.CATEGORY
            }
        };

        await processor.process(job);

        expect(mockOrchestrator.execute).toHaveBeenCalled();
        const executeCall = mockOrchestrator.execute.mock.calls[0][0];
        expect(executeCall.context.entityType).toBe(EntityType.CATEGORY);
    });
});
