import { EntityType } from '@cdo/shared';
import { planWaves, getWaveDependencies } from '../wave-planner';

describe('planWaves', () => {
    it('returns full MVP order when all four entity types are selected', () => {
        // Canonical topological order: CATEGORIES first (no deps), then PRODUCTS
        // (unblocked by CATEGORIES, canonical index 1 < CUSTOMERS index 2 so it goes next),
        // then CUSTOMERS (no deps, processed after PRODUCTS in queue), then ORDERS.
        const result = planWaves([
            EntityType.ORDERS,
            EntityType.CUSTOMERS,
            EntityType.PRODUCTS,
            EntityType.CATEGORIES,
        ]);
        expect(result).toEqual([
            EntityType.CATEGORIES,
            EntityType.PRODUCTS,
            EntityType.CUSTOMERS,
            EntityType.ORDERS,
        ]);
    });

    it('returns [CATEGORIES, PRODUCTS] when only those two are selected', () => {
        const result = planWaves([EntityType.PRODUCTS, EntityType.CATEGORIES]);
        expect(result).toEqual([EntityType.CATEGORIES, EntityType.PRODUCTS]);
    });

    it('returns [CUSTOMERS, ORDERS] when only those two are selected', () => {
        const result = planWaves([EntityType.ORDERS, EntityType.CUSTOMERS]);
        expect(result).toEqual([EntityType.CUSTOMERS, EntityType.ORDERS]);
    });

    it('returns [CATEGORIES] when only CATEGORIES is selected', () => {
        expect(planWaves([EntityType.CATEGORIES])).toEqual([EntityType.CATEGORIES]);
    });

    it('returns [ORDERS] when only ORDERS is selected (dependency not in selected set)', () => {
        // ORDERS depends on CUSTOMERS, but CUSTOMERS is not selected.
        // The planner must NOT auto-add CUSTOMERS — it only sorts what was selected.
        expect(planWaves([EntityType.ORDERS])).toEqual([EntityType.ORDERS]);
    });

    it('returns [PRODUCTS] alone even though CATEGORIES is a dependency (not selected)', () => {
        expect(planWaves([EntityType.PRODUCTS])).toEqual([EntityType.PRODUCTS]);
    });

    it('is stable when given inputs in any order', () => {
        const a = planWaves([EntityType.CATEGORIES, EntityType.PRODUCTS, EntityType.CUSTOMERS, EntityType.ORDERS]);
        const b = planWaves([EntityType.ORDERS, EntityType.CUSTOMERS, EntityType.PRODUCTS, EntityType.CATEGORIES]);
        expect(a).toEqual(b);
    });

    it('returns empty array for empty input', () => {
        expect(planWaves([])).toEqual([]);
    });
});

describe('getWaveDependencies', () => {
    const fullPlan = [
        EntityType.CATEGORIES,
        EntityType.PRODUCTS,
        EntityType.CUSTOMERS,
        EntityType.ORDERS,
    ];

    it('returns [] for CATEGORIES (no deps)', () => {
        expect(getWaveDependencies(EntityType.CATEGORIES, fullPlan)).toEqual([]);
    });

    it('returns [CATEGORIES] for PRODUCTS in full plan', () => {
        expect(getWaveDependencies(EntityType.PRODUCTS, fullPlan)).toEqual([EntityType.CATEGORIES]);
    });

    it('returns [CUSTOMERS] for ORDERS in full plan', () => {
        expect(getWaveDependencies(EntityType.ORDERS, fullPlan)).toEqual([EntityType.CUSTOMERS]);
    });

    it('returns [] for PRODUCTS when CATEGORIES is not in planned waves', () => {
        // If user did not select CATEGORIES, PRODUCTS has no resolvable dep
        expect(getWaveDependencies(EntityType.PRODUCTS, [EntityType.PRODUCTS])).toEqual([]);
    });
});
