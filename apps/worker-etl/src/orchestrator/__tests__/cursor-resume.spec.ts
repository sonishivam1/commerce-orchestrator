/**
 * cursor-resume.spec.ts
 *
 * Integration-level unit tests for cursor checkpointing (Phase 2.5).
 *
 * Proves the following invariants:
 *
 * 1. WaveExecutorService forwards `startCursor` from WaveExecutionConfig into the
 *    EtlEngine context so source.extract(startCursor) is called with the correct value.
 *
 * 2. After each successful batch, the wave executor reads source.getCursor() and
 *    persists the returned value to MigrationRunRepository.updateWave(), creating a
 *    durable checkpoint.
 *
 * 3. B1 Resume: a "failed run at cursor X" scenario proves that creating a new run
 *    with the cursor inherited from the previous run causes the source to begin
 *    extraction from cursor X rather than from the beginning of the dataset.
 *    Only batch 2 items reach the target — batch 1 items are NOT re-processed.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { WaveExecutorService } from '../wave-executor.service';
import { IdentityMapRepository, MigrationRunRepository, DlqRepository } from '@cdo/db';
import { EntityType, WaveStatus } from '@cdo/shared';
import type { SourceConnector, TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalCategory } from '@cdo/shared';

jest.mock('@cdo/connectors', () => ({
    ConnectorFactory: {
        createSource: jest.fn(),
        createTarget: jest.fn(),
    },
}));
import { ConnectorFactory } from '@cdo/connectors';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const CAT_BATCH_1: CanonicalCategory = {
    key: 'cat-batch-1',
    name: { 'en-US': 'Batch 1 Category' },
    slug: { 'en-US': 'batch-1-category' },
} as unknown as CanonicalCategory;

const CAT_BATCH_2: CanonicalCategory = {
    key: 'cat-batch-2',
    name: { 'en-US': 'Batch 2 Category' },
    slug: { 'en-US': 'batch-2-category' },
} as unknown as CanonicalCategory;

/** Cursor value after batch 1 has been processed by the target */
const CURSOR_AFTER_BATCH_1 = 'uuid-page-1-last-id';

// ── Helpers ──────────────────────────────────────────────────────────────────────

function makeTargetConnector(): TargetConnector<CanonicalCategory> {
    return {
        initialize: jest.fn().mockResolvedValue(undefined),
        load: jest.fn().mockImplementation(async (batch: CanonicalCategory[]) =>
            batch.map((item) => ({
                key: item.key,
                success: true,
                targetId: `gid://shopify/Collection/${item.key}`,
            } as LoadResult)),
        ),
        getCapabilities: jest.fn().mockReturnValue(['upsert']),
    };
}

/**
 * Source that yields TWO batches (batch 1 then batch 2) when called without a cursor.
 * When called with cursor = CURSOR_AFTER_BATCH_1, yields only batch 2.
 *
 * After each batch is yielded, currentCursor is set to CURSOR_AFTER_BATCH_1 (or a
 * second cursor for batch 2) so getCursor() returns the correct value while the
 * generator is suspended at the yield point.
 */
function makeTwoBatchSource(): SourceConnector<CanonicalCategory> & { extractCalledWithCursor: string | undefined } {
    let currentCursor: string | undefined;
    let extractCalledWithCursor: string | undefined;

    const source = {
        initialize: jest.fn().mockResolvedValue(undefined),
        async *extract(cursor?: string): AsyncIterableIterator<CanonicalCategory[]> {
            extractCalledWithCursor = cursor;

            if (!cursor) {
                // Full run: yield batch 1 first
                currentCursor = CURSOR_AFTER_BATCH_1;
                yield [CAT_BATCH_1];
            }

            // Batch 2 is always yielded (whether starting from beginning or resuming)
            currentCursor = 'uuid-page-2-last-id';
            yield [CAT_BATCH_2];
        },
        getCursor(): string | undefined {
            return currentCursor;
        },
        get extractCalledWithCursor() {
            return extractCalledWithCursor;
        },
    };

    return source as any;
}

// ── Test suite ───────────────────────────────────────────────────────────────────

describe('WaveExecutorService — cursor checkpointing + B1 resume', () => {
    let service: WaveExecutorService;

    const mockIdentityMapRepo = {
        getResolutionMap: jest.fn(),
        bulkUpsert: jest.fn(),
        countForEntityType: jest.fn(),
    };
    const mockRunRepo = {
        updateWave: jest.fn(),
    };
    const mockDlqRepo = {
        create: jest.fn(),
    };

    const baseConfig = {
        entityType: EntityType.CATEGORIES,
        plannedWaves: [EntityType.CATEGORIES],
        run: {
            _id: 'run-002',
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
            jobId: 'run-002',
            correlationId: 'corr-002',
            sourceCredentials: { clientId: 'ct-client' },
            targetCredentials: { accessToken: 'shpat-xxx' },
            migrationProjectId: 'proj-001',
            dryRun: false,
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockIdentityMapRepo.getResolutionMap.mockResolvedValue(new Map());
        mockIdentityMapRepo.bulkUpsert.mockResolvedValue({ created: 1, updated: 0 });
        mockRunRepo.updateWave.mockResolvedValue(undefined);
        mockDlqRepo.create.mockResolvedValue(undefined);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WaveExecutorService,
                { provide: IdentityMapRepository, useValue: mockIdentityMapRepo },
                { provide: MigrationRunRepository, useValue: mockRunRepo },
                { provide: DlqRepository, useValue: mockDlqRepo },
            ],
        }).compile();

        service = module.get<WaveExecutorService>(WaveExecutorService);
    });

    // ── 1. startCursor is forwarded to source.extract() ──────────────────────────

    describe('startCursor propagation', () => {
        it('calls source.extract() with undefined when no startCursor is provided', async () => {
            const source = makeTwoBatchSource();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(makeTargetConnector());

            await service.executeWave(baseConfig);

            // extract() must be called with undefined so it starts from the beginning
            expect((source as any).extractCalledWithCursor).toBeUndefined();
        });

        it('calls source.extract() with the startCursor value from WaveExecutionConfig', async () => {
            const source = makeTwoBatchSource();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(makeTargetConnector());

            await service.executeWave({
                ...baseConfig,
                startCursor: CURSOR_AFTER_BATCH_1,
            });

            // extract() must receive the inherited cursor so extraction skips batch 1
            expect((source as any).extractCalledWithCursor).toBe(CURSOR_AFTER_BATCH_1);
        });
    });

    // ── 2. Cursor is checkpointed after each successful batch ─────────────────────

    describe('cursor checkpointing', () => {
        it('persists cursor to DB via updateWave after a successful run', async () => {
            const source = makeTwoBatchSource();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(makeTargetConnector());

            await service.executeWave(baseConfig);

            // At least one updateWave call must include a cursor field.
            //
            // Implementation note on batch accumulation:
            //   EtlEngine accumulates source items until currentBatch.length >= batchSize (50).
            //   With only 2 items across 2 source pages, both pages are consumed before the
            //   engine's threshold is reached, so processBatch is called ONCE (after the loop
            //   drains the generator).  At that point, currentCursor = 'uuid-page-2-last-id'
            //   (the second page cursor).  The single checkpoint therefore carries the last
            //   cursor — which is correct: on resume, extraction would start after page 2 and
            //   immediately find no more items, completing the wave instantly.
            const cursorCalls = mockRunRepo.updateWave.mock.calls.filter(
                (call: unknown[]) =>
                    call[2] !== undefined &&
                    typeof (call[2] as Record<string, unknown>)['cursor'] === 'string',
            );
            expect(cursorCalls.length).toBeGreaterThan(0);

            const firstCursorCall = cursorCalls[0];
            expect(firstCursorCall[0]).toBe('run-002');                   // runId
            expect(firstCursorCall[1]).toBe(EntityType.CATEGORIES);       // entityType
            // With 2 items total, both source batches are accumulated into one engine batch.
            // The cursor reflects the LAST consumed source page.
            expect((firstCursorCall[2] as Record<string, unknown>)['cursor']).toBe('uuid-page-2-last-id');
        });

        it('exposes the latest cursor on WaveStats.cursor after the run completes', async () => {
            const source = makeTwoBatchSource();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(makeTargetConnector());

            const stats = await service.executeWave(baseConfig);

            // stats.cursor should be the last cursor that was checkpointed
            expect(stats.cursor).toBe('uuid-page-2-last-id');
        });
    });

    // ── 3. B1 Resume: failed run at cursor X → new run resumes from X ────────────

    describe('B1 resume — extraction resumes from inherited cursor', () => {
        it('processes only batch-2 items when startCursor = CURSOR_AFTER_BATCH_1', async () => {
            // Simulates: previous run processed batch 1 and checkpointed its cursor.
            // A new run is created with resumeFromRunId; the orchestrator passes
            // startCursor = CURSOR_AFTER_BATCH_1 to executeWave.
            const source = makeTwoBatchSource();
            const target = makeTargetConnector();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(target);

            await service.executeWave({
                ...baseConfig,
                startCursor: CURSOR_AFTER_BATCH_1,
            });

            // target.load() should only have been called with the batch-2 item
            const loadCalls = (target.load as jest.Mock).mock.calls;
            const allLoadedKeys = loadCalls.flatMap((call: unknown[]) =>
                (call[0] as CanonicalCategory[]).map((item) => item.key),
            );

            expect(allLoadedKeys).toContain('cat-batch-2');
            // Batch 1 must NOT be re-processed — the whole point of cursor resume
            expect(allLoadedKeys).not.toContain('cat-batch-1');
        });

        it('processes both batches from scratch when no startCursor is provided', async () => {
            // Control case: without a cursor the full dataset is processed.
            const source = makeTwoBatchSource();
            const target = makeTargetConnector();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(target);

            await service.executeWave(baseConfig);

            const loadCalls = (target.load as jest.Mock).mock.calls;
            const allLoadedKeys = loadCalls.flatMap((call: unknown[]) =>
                (call[0] as CanonicalCategory[]).map((item) => item.key),
            );

            expect(allLoadedKeys).toContain('cat-batch-1');
            expect(allLoadedKeys).toContain('cat-batch-2');
        });

        it('counts only batch-2 items in processedCount when resuming', async () => {
            const source = makeTwoBatchSource();
            const target = makeTargetConnector();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(target);

            const stats = await service.executeWave({
                ...baseConfig,
                startCursor: CURSOR_AFTER_BATCH_1,
            });

            // Only 1 item from batch 2 was processed — batch 1 was skipped entirely
            expect(stats.processedCount).toBe(1);
        });

        it('marks wave COMPLETED after a successful resumed run', async () => {
            const source = makeTwoBatchSource();
            (ConnectorFactory.createSource as jest.Mock).mockReturnValue(source);
            (ConnectorFactory.createTarget as jest.Mock).mockReturnValue(makeTargetConnector());

            await service.executeWave({
                ...baseConfig,
                startCursor: CURSOR_AFTER_BATCH_1,
            });

            expect(mockRunRepo.updateWave).toHaveBeenCalledWith(
                'run-002',
                EntityType.CATEGORIES,
                expect.objectContaining({ status: WaveStatus.COMPLETED }),
            );
        });
    });
});
