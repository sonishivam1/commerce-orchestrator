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
 * MigrationRunStatus — execution state of a single MigrationRun.
 */
export enum MigrationRunStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}
