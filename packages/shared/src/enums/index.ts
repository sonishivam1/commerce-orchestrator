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

export enum Platform {
    COMMERCETOOLS = 'commercetools',
    SHOPIFY = 'shopify',
    BIGCOMMERCE = 'bigcommerce',
}

export enum ErrorType {
    VALIDATION = 'ValidationError',
    TRANSIENT = 'TransientError',
    FATAL = 'FatalError',
}
