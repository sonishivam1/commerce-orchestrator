// Shared enums — used across the entire monorepo
// These are the authoritative enum definitions

export enum JobKind {
    SCRAPE_IMPORT = 'SCRAPE_IMPORT',
    CROSS_PLATFORM_MIGRATION = 'CROSS_PLATFORM_MIGRATION',
    PLATFORM_CLONE = 'PLATFORM_CLONE',
    EXPORT = 'EXPORT',
}

export enum JobStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    PAUSED = 'PAUSED',
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
