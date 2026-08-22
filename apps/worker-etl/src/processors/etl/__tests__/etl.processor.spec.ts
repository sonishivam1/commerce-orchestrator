import { EtlProcessor } from '../etl.processor';
import { EntityType } from '@cdo/shared';
// @ts-ignore
import { jest } from '@jest/globals';

describe('EtlProcessor', () => {
    let processor: EtlProcessor;
    let mockCredRepo: any;
    let mockJobRepo: any;
    let mockOrchestrator: any;
    let mockMigrationRunOrchestrator: any;
    let mockDecryptor: any;
    let mockLockService: any;

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
        mockMigrationRunOrchestrator = {
            execute: jest.fn().mockResolvedValue(undefined)
        };
        mockDecryptor = {
            decrypt: jest.fn().mockReturnValue({})
        };
        mockLockService = {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined)
        };

        processor = new EtlProcessor(
            mockCredRepo,
            mockJobRepo,
            mockOrchestrator,
            mockMigrationRunOrchestrator,
            mockDecryptor,
            mockLockService,
        );
    });

    it('existing Product migration remains compatible (defaults to PRODUCTS if entityTypes is missing)', async () => {
        const job: any = {
            id: 'job-1',
            data: {
                tenantId: 't1',
                jobId: 'job-1',
                kind: 'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId: 'sc1',
                targetCredentialId: 'tc1'
                // Notice: no entityTypes provided!
            }
        };

        await processor.process(job);

        expect(mockOrchestrator.execute).toHaveBeenCalled();
        const executeCall = mockOrchestrator.execute.mock.calls[0][0];
        expect(executeCall.context.entityTypes).toContain(EntityType.PRODUCTS);
    });

    it('respects explicitly provided entityTypes', async () => {
        const job: any = {
            id: 'job-1',
            data: {
                tenantId: 't1',
                jobId: 'job-1',
                kind: 'CROSS_PLATFORM_MIGRATION',
                sourceCredentialId: 'sc1',
                targetCredentialId: 'tc1',
                entityTypes: [EntityType.CATEGORIES]
            }
        };

        await processor.process(job);

        expect(mockOrchestrator.execute).toHaveBeenCalled();
        const executeCall = mockOrchestrator.execute.mock.calls[0][0];
        expect(executeCall.context.entityTypes).toContain(EntityType.CATEGORIES);
    });
});
