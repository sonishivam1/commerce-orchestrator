import { EntityType } from '@cdo/shared';
import { WAVE_DEPENDENCIES, getDependencies } from './wave-dependency';

/**
 * WavePlanner — pure function that topologically sorts a set of selected
 * EntityTypes according to the MVP dependency graph.
 *
 * Rules:
 * - An entity type is only included if it was selected by the user.
 * - Dependencies are satisfied before dependents, but only among selected types.
 * - If a selected type depends on a type that is NOT selected, the dependency is
 *   simply absent (we do not auto-add unselected types to the wave list).
 * - On a circular dependency the function throws immediately — there are none in
 *   the MVP graph but the guard protects against future mistakes.
 *
 * @param selectedEntityTypes - The entity types the MigrationProject will migrate
 * @returns An ordered array of EntityType values representing waves to execute
 */
export function planWaves(selectedEntityTypes: EntityType[]): EntityType[] {
    if (selectedEntityTypes.length === 0) return [];

    const selected = new Set<EntityType>(selectedEntityTypes);

    // Kahn's algorithm — O(V + E)
    const inDegree = new Map<EntityType, number>();
    const adjacency = new Map<EntityType, EntityType[]>(); // dep → dependents

    for (const et of selected) {
        if (!inDegree.has(et)) inDegree.set(et, 0);
        if (!adjacency.has(et)) adjacency.set(et, []);
    }

    for (const et of selected) {
        const deps = getDependencies(et, selected);
        inDegree.set(et, deps.length);

        for (const dep of deps) {
            const dependents = adjacency.get(dep) ?? [];
            dependents.push(et);
            adjacency.set(dep, dependents);
        }
    }

    // Start with nodes that have no dependencies among selected types
    const queue: EntityType[] = [];
    for (const [et, degree] of inDegree) {
        if (degree === 0) queue.push(et);
    }

    // Stable ordering: sort the queue by the canonical wave order so that when
    // two types share in-degree 0 the output is deterministic.
    const CANONICAL_ORDER: EntityType[] = [
        EntityType.CATEGORIES,
        EntityType.PRODUCTS,
        EntityType.CUSTOMERS,
        EntityType.ORDERS,
    ];
    queue.sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));

    const result: EntityType[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        result.push(current);

        const dependents = adjacency.get(current) ?? [];
        for (const dep of dependents) {
            const newDegree = (inDegree.get(dep) ?? 1) - 1;
            inDegree.set(dep, newDegree);
            if (newDegree === 0) {
                queue.push(dep);
                queue.sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));
            }
        }
    }

    if (result.length !== selected.size) {
        throw new Error(
            `Wave planner detected a circular dependency among entity types: ${selectedEntityTypes.join(', ')}`,
        );
    }

    return result;
}

/**
 * Return the dependency entity types for a given wave, filtered to those
 * that were actually planned (i.e. are in the ordered wave list).
 * Used by the wave executor to know which resolution maps to load before running.
 */
export function getWaveDependencies(entityType: EntityType, plannedWaves: EntityType[]): EntityType[] {
    const planned = new Set<EntityType>(plannedWaves);
    return (WAVE_DEPENDENCIES[entityType] ?? []).filter((dep) => planned.has(dep));
}
