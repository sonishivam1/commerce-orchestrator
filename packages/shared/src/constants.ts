/**
 * @file constants.ts
 * @package @cdo/shared
 *
 * Single source of truth for all platform-wide constants.
 * Import from here — never use magic strings or raw numbers directly in code.
 */

// ─── Queue Names ─────────────────────────────────────────────────────────────
// Must match exactly between producers (@cdo/queue) and consumers (apps/worker-*)

/** BullMQ queue for API-based ETL jobs (CROSS_PLATFORM_MIGRATION, PLATFORM_CLONE, EXPORT) */
export const QUEUE_ETL = 'etl-queue';

/** BullMQ queue for Playwright-based scrape import jobs (SCRAPE_IMPORT) */
export const QUEUE_SCRAPE = 'scrape-queue';

// ─── Job Retry Policy ────────────────────────────────────────────────────────

/** How many times BullMQ will retry a TransientError before sending to DLQ */
export const MAX_JOB_RETRIES = 3;

/** How many times the scrape worker retries before DLQ (fewer — GPU/browser cost) */
export const MAX_SCRAPE_RETRIES = 2;

/** Initial delay (ms) before first retry — grows exponentially each attempt */
export const RETRY_BACKOFF_DELAY_MS = 5_000;

/** Scrape jobs wait longer before retry (browser startup overhead) */
export const SCRAPE_RETRY_BACKOFF_DELAY_MS = 10_000;

// ─── Completed Job Retention ──────────────────────────────────────────────────

/** How many completed ETL jobs BullMQ keeps in Redis before auto-cleanup */
export const COMPLETED_JOB_RETENTION_COUNT = 100;

// ─── Redlock (Distributed Locking) ───────────────────────────────────────────

/** TTL for a target-environment Redis lock (30 minutes) — released in finally block */
export const LOCK_TTL_MS = 30 * 60 * 1_000;

/** Prefix for Redis lock keys. Format: `lock:{tenantId}:{targetCredentialId}` */
export const LOCK_KEY_PREFIX = 'lock';

// ─── Pipeline Batching ────────────────────────────────────────────────────────

/** Default number of entities per extract/load batch in the Core Engine */
export const DEFAULT_BATCH_SIZE = 50;

/** Maximum consecutive failures before the circuit breaker trips a FatalError */
export const CIRCUIT_BREAKER_THRESHOLD = 10;

// ─── Canonical Schema Version ────────────────────────────────────────────────

/** Current canonical contract version — bump when making breaking changes */
export const CANONICAL_VERSION = 'v1' as const;
