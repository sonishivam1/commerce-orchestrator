import { EntityType } from '@cdo/shared';

/**
 * MVP dependency graph — defines which entity types must complete before another can start.
 *
 * CATEGORIES: no deps — runs first; its IdentityMap entries give Products their Shopify collection IDs.
 * PRODUCTS: depends on CATEGORIES — needs category sourceKey → targetId mappings from IdentityMap.
 * CUSTOMERS: no deps — can run independently.
 * ORDERS: depends on CUSTOMERS — needs customer sourceKey → targetId mappings from IdentityMap.
 *
 * The wave planner uses this graph to topologically sort whatever entity types a
 * MigrationProject has selected, so only required entities run in the correct order.
 */
export const WAVE_DEPENDENCIES: Readonly<Record<EntityType, EntityType[]>> = {
    [EntityType.CATEGORIES]: [],
    [EntityType.PRODUCTS]: [EntityType.CATEGORIES],
    [EntityType.CUSTOMERS]: [],
    [EntityType.ORDERS]: [EntityType.CUSTOMERS],
};

/**
 * Return the immediate dependencies for a given entity type.
 * Only returns dependencies that are present in the `selected` set
 * so the planner never waits for an entity type that is not being migrated.
 */
export function getDependencies(entityType: EntityType, selected: Set<EntityType>): EntityType[] {
    return (WAVE_DEPENDENCIES[entityType] ?? []).filter((dep) => selected.has(dep));
}
