import { EtlProcessor } from '../etl.processor';
// @ts-ignore
import { jest } from '@jest/globals';

describe('EtlProcessor', () => {
    let processor: EtlProcessor;
    let mockMigrationRunOrchestrator: any;
    let mockLockService: any;

    beforeEach(() => {
        mockMigrationRunOrchestrator = {
            execute: jest.fn().mockResolvedValue(undefined),
        };
        mockLockService = {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined),
        };

        processor = new EtlProcessor(mockMigrationRunOrchestrator, mockLockService);
    });

    it('delegates a MIGRATION_RUN job to the orchestrator with a lock held', async () => {
        const job: any = {
            id: 'run-1',
            data: {
                tenantId: 't1',
                migrationRunId: 'run-1',
                targetCredentialId: 'tc1',
                dryRun: false,
                correlationId: 'corr-1',
            },
        };

        await processor.process(job);

        expect(mockLockService.acquire).toHaveBeenCalledWith('t1', 'tc1');
        expect(mockMigrationRunOrchestrator.execute).toHaveBeenCalledWith({
            tenantId: 't1',
            migrationRunId: 'run-1',
            correlationId: 'corr-1',
            dryRun: false,
        });
        expect(mockLockService.release).toHaveBeenCalledWith('lock');
    });

    it('releases the lock and rethrows when the orchestrator fails', async () => {
        mockMigrationRunOrchestrator.execute.mockRejectedValueOnce(new Error('boom'));
        const job: any = {
            id: 'run-2',
            data: { tenantId: 't1', migrationRunId: 'run-2', targetCredentialId: 'tc1' },
        };

        await expect(processor.process(job)).rejects.toThrow('boom');
        expect(mockLockService.release).toHaveBeenCalledWith('lock');
    });
});
