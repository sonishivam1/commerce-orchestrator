import { EtlEngine, EtlContext } from '../engine/etl.engine';
import { CanonicalProduct, CanonicalEntity, ErrorType, EntityType } from '@cdo/shared';
import { SourceConnector, TargetConnector, LoadResult } from '../interfaces/index';
// @ts-ignore
import { jest } from '@jest/globals';

class MockSource implements SourceConnector<CanonicalEntity> {
    private items: CanonicalEntity[];
    constructor(items: CanonicalEntity[]) {
        this.items = items;
    }
    async initialize() {}
    async *extract() {
        yield this.items;
    }
}

class MockTarget implements TargetConnector<CanonicalEntity> {
    public mockLoad = jest.fn((batch: CanonicalEntity[]): Promise<LoadResult[]> => {
        return Promise.resolve(batch.map(item => ({ key: item.key, success: true })));
    });

    async initialize() {}
    load(batch: CanonicalEntity[]) { return this.mockLoad(batch); }
    getCapabilities() { return []; }
}

describe('EtlEngine', () => {
    const context: EtlContext = {
        tenantId: 'tenant-1',
        jobId: 'job-1',
        correlationId: 'corr-1',
        sourceCredentials: {},
        targetCredentials: {},
        entityType: EntityType.PRODUCT,
        resolveIdentity: async () => null
    };
    const dummyItems = Array.from({ length: 5 }).map((_, i) => ({
        key: `item-${i}`
    } as CanonicalEntity));

    it('should process batches correctly and emit events', async () => {
        const source = new MockSource(dummyItems);
        const target = new MockTarget();
        const engine = new EtlEngine(source, target, context, { batchSize: 2 });

        const progressFn = jest.fn();
        const completeFn = jest.fn();

        engine.on('progress', progressFn);
        engine.on('complete', completeFn);

        await engine.run();

        // 5 items, batchSize 2 -> 3 target.load calls
        expect(target.mockLoad).toHaveBeenCalledTimes(3);
        expect(target.mockLoad).toHaveBeenNthCalledWith(1, dummyItems.slice(0, 2));
        expect(target.mockLoad).toHaveBeenNthCalledWith(2, dummyItems.slice(2, 4));
        expect(target.mockLoad).toHaveBeenNthCalledWith(3, dummyItems.slice(4, 5));

        expect(progressFn).toHaveBeenCalledTimes(3);
        expect(completeFn).toHaveBeenCalledTimes(1);
    });

    it('should fallback to item-by-item processing if batch load throws an error', async () => {
        const source = new MockSource([dummyItems[0], dummyItems[1]]);
        const target = new MockTarget();
        
        let batchFailures = 0;
        // Mock target to throw Transient error for the batch, but succeed individually
        target.mockLoad.mockImplementation((batch: CanonicalEntity[]) => {
            if (batch.length === 2 && batchFailures < 3) {
                batchFailures++;
                throw new Error('Transient Batch Error');
            }
            return Promise.resolve(batch.map((item: CanonicalEntity) => ({ key: item.key, success: true })));
        });

        const engine = new EtlEngine(source, target, context, { batchSize: 2, maxRetries: 2 });
        const progressFn = jest.fn();
        engine.on('progress', progressFn);
        
        // This will batch the 2 items, throw 3 times (hits maxRetries=2 then falls back)
        await engine.run();
        
        // Target is called:
        // 1st: target(batch) throw
        // 2nd: retry target(batch) throw 
        // 3rd: retry target(batch) throw (maxRetries reached, fallback to item by item)
        // 4th: target([item0]) -> success
        // 5th: target([item1]) -> success
        expect(progressFn).toHaveBeenCalled();
        expect(progressFn.mock.calls[0][0].length).toBe(2);
    });

    it('should trip circuit breaker on repeated target item failures', async () => {
        const source = new MockSource(Array.from({ length: 15 }).map((_, i) => ({
            key: `bad-${i}`
        } as CanonicalEntity)));
        const target = new MockTarget();
        
        // Always fail to load
        target.mockLoad.mockImplementation(() => {
            throw new Error('Service Unavailable');
        });

        const cbFn = jest.fn();
        const engine = new EtlEngine(source, target, context, { 
            batchSize: 1, 
            maxRetries: 0, 
            circuitBreaker: cbFn 
        });

        await engine.run();

        // The circuit breaker should trip after 10 failures by default
        expect(cbFn).toHaveBeenCalled();
        expect(cbFn.mock.calls[0][0].message).toContain('Circuit breaker tripped');
    });

    it('should correctly emit failure events for individual problematic items', async () => {
        const source = new MockSource([dummyItems[0], dummyItems[1]]);
        const target = new MockTarget();
        
        target.mockLoad.mockImplementation((batch: CanonicalEntity[]) => {
            return Promise.resolve([
                { key: 'item-0', success: true },
                { key: 'item-1', success: false, error: 'Validation Error: bad field' }
            ]);
        });

        const failureFn = jest.fn();
        const engine = new EtlEngine(source, target, context, { batchSize: 2 });
        engine.on('failure', failureFn);

        await engine.run();

        expect(failureFn).toHaveBeenCalledTimes(1);
        expect(failureFn.mock.calls[0][0].message).toEqual('Validation Error: bad field');
        expect(failureFn.mock.calls[0][1]).toEqual(dummyItems[1]); // the item that failed
    });

    it('should persist identity mapping only after successful target load', async () => {
        const source = new MockSource([dummyItems[0], dummyItems[1]]);
        const target = new MockTarget();
        
        target.mockLoad.mockImplementation((batch: CanonicalEntity[]) => {
            return Promise.resolve([
                { key: 'item-0', success: true, targetId: 'target-0' },
                { key: 'item-1', success: false, error: 'Failed' } // No targetId or success
            ]);
        });

        const recordIdentities = jest.fn().mockResolvedValue(undefined);
        const testContext = { ...context, recordIdentities };
        const engine = new EtlEngine(source, target, testContext, { batchSize: 2 });
        
        await engine.run();
        
        expect(recordIdentities).toHaveBeenCalledTimes(1);
        const passedResults = recordIdentities.mock.calls[0][0];
        expect(passedResults.length).toBe(1); // Only the successful one
        expect(passedResults[0].key).toBe('item-0');
        expect(passedResults[0].targetId).toBe('target-0');
    });

    it('failed target load does not create an identity mapping', async () => {
        const source = new MockSource([dummyItems[0]]);
        const target = new MockTarget();
        
        target.mockLoad.mockImplementation((batch: CanonicalEntity[]) => {
            return Promise.resolve([
                { key: 'item-0', success: false, error: 'Failed' }
            ]);
        });

        const recordIdentities = jest.fn().mockResolvedValue(undefined);
        const testContext = { ...context, recordIdentities };
        const engine = new EtlEngine(source, target, testContext, { batchSize: 2 });
        
        await engine.run();
        
        // recordIdentities should not be called because there are no successful results
        expect(recordIdentities).not.toHaveBeenCalled();
    });
});
