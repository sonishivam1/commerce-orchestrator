// Shared enums — used across the entire monorepo
// These are the authoritative enum definitions

/**
 * JobKind — the one kind of BullMQ job. A run executes a MigrationProject in
 * either MIGRATE or EXPORT mode (mode lives on the project, not the job).
 */
export enum JobKind {
    MIGRATION_RUN = 'MIGRATION_RUN',
}

/**
 * Platform — authoritative lowercase values stored in the DB and used for all
 * platform-string comparisons across the monorepo.
 * Always use this enum; never compare raw strings.
 */
export enum Platform {
    COMMERCETOOLS = 'commercetools',
    SHOPIFY = 'shopify',
    BIGCOMMERCE = 'bigcommerce',
}

/**
 * EntityType — what kind of data an ETL job migrates.
 * A single job can request multiple entity types; the orchestrator
 * runs one EtlEngine pass per type.
 */
export enum EntityType {
    PRODUCTS = 'PRODUCTS',
    CATEGORIES = 'CATEGORIES',
    CUSTOMERS = 'CUSTOMERS',
    ORDERS = 'ORDERS',
}

/**
 * The fixed order entity waves run in, so foreign-key dependencies are satisfied
 * in the target: categories before products, customers before orders. A run's
 * selected entity types are filtered against this list — there is no runtime
 * topological sort.
 */
export const CANONICAL_ENTITY_ORDER: EntityType[] = [
    EntityType.CATEGORIES,
    EntityType.PRODUCTS,
    EntityType.CUSTOMERS,
    EntityType.ORDERS,
];

/** Which already-migrated entity types a given wave needs identity maps for. */
export const ENTITY_WAVE_DEPENDENCIES: Record<EntityType, EntityType[]> = {
    [EntityType.CATEGORIES]: [],
    [EntityType.PRODUCTS]: [EntityType.CATEGORIES],
    [EntityType.CUSTOMERS]: [],
    [EntityType.ORDERS]: [EntityType.CUSTOMERS, EntityType.PRODUCTS],
};

/** Ordered subset of `selected`, in canonical wave order. */
export function planEntityWaves(selected: EntityType[]): EntityType[] {
    const set = new Set(selected);
    return CANONICAL_ENTITY_ORDER.filter((e) => set.has(e));
}

/** Dependencies of `entityType` that are also part of this run's planned waves. */
export function entityWaveDependencies(
    entityType: EntityType,
    plannedWaves: EntityType[],
): EntityType[] {
    const planned = new Set(plannedWaves);
    return (ENTITY_WAVE_DEPENDENCIES[entityType] ?? []).filter((d) => planned.has(d));
}

export enum ErrorType {
    VALIDATION = 'ValidationError',
    TRANSIENT = 'TransientError',
    FATAL = 'FatalError',
}

/**
 * ConnectionHealth — real-time health state of a platform connection.
 * Stored on the Connection document; updated when credentials are tested.
 */
export enum ConnectionHealth {
    UNTESTED = 'UNTESTED',
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    ERROR = 'ERROR',
}

/**
 * WaveStatus — execution state of a single entity-type wave within a MigrationRun.
 * Stored inside MigrationRun.waves[].status.
 */
export enum WaveStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    SKIPPED = 'SKIPPED',
}

/**
 * MigrationProjectStatus — lifecycle state of a MigrationProject.
 */
export enum MigrationProjectStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED',
}

/**
 * MigrationMode — what a project does with the extracted data.
 * MIGRATE: upsert into a target platform connection.
 * EXPORT:  write to a downloadable CSV/JSON file.
 */
export enum MigrationMode {
    MIGRATE = 'MIGRATE',
    EXPORT = 'EXPORT',
}

/** Output file format for EXPORT-mode projects. */
export enum ExportFormat {
    CSV = 'CSV',
    JSON = 'JSON',
}

/**
 * MigrationRunStatus — execution state of a single MigrationRun.
 */
export enum MigrationRunStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}
