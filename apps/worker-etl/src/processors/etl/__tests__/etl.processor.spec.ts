import { EtlProcessor } from '../etl.processor';
// @ts-ignore
import { jest } from '@jest/globals';

describe('EtlProcessor', () => {
    let processor: EtlProcessor;
    let mockOrchestrator: any;

    beforeEach(() => {
        mockOrchestrator = { execute: jest.fn().mockResolvedValue(undefined) };
        processor = new EtlProcessor(mockOrchestrator);
    });

    it('delegates a MIGRATION_RUN job to the orchestrator', async () => {
        const job: any = {
            id: 'run-1',
            data: {
                tenantId: 't1',
                migrationRunId: 'run-1',
                dryRun: false,
                correlationId: 'corr-1',
            },
        };

        await processor.process(job);

        expect(mockOrchestrator.execute).toHaveBeenCalledWith({
            tenantId: 't1',
            migrationRunId: 'run-1',
            correlationId: 'corr-1',
            dryRun: false,
        });
    });

    it('rethrows when the orchestrator fails', async () => {
        mockOrchestrator.execute.mockRejectedValueOnce(new Error('boom'));
        const job: any = {
            id: 'run-2',
            data: { tenantId: 't1', migrationRunId: 'run-2' },
        };

        await expect(processor.process(job)).rejects.toThrow('boom');
    });
});
