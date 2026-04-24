/**
 * @file scraper.config.ts
 * @package @cdo/ingestion
 *
 * Configuration interface for the ScraperService.
 * All values are injected by the caller — never hardcoded here.
 */

/** Default concurrency: conservative to avoid being blocked */
export const DEFAULT_SCRAPER_CONCURRENCY = 3;

/** Default navigation timeout in ms (30s) */
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

/** Default page wait-for idle timeout in ms (5s) */
export const DEFAULT_IDLE_TIMEOUT_MS = 5_000;

export interface ScraperConfig {
    /**
     * Number of parallel browser contexts to run.
     * Defaults to DEFAULT_SCRAPER_CONCURRENCY.
     */
    concurrency?: number;

    /**
     * Maximum time in ms to wait for a page navigation to complete.
     * Defaults to DEFAULT_NAVIGATION_TIMEOUT_MS.
     */
    navigationTimeoutMs?: number;

    /**
     * Maximum time in ms to wait for the page network to go idle after load.
     * Defaults to DEFAULT_IDLE_TIMEOUT_MS.
     */
    idleTimeoutMs?: number;

    /**
     * Optional User-Agent override.
     * If not set, the stealth plugin manages the UA automatically.
     */
    userAgent?: string;

    /**
     * Optional HTTP proxy to route all browser traffic through.
     * Format: 'http://host:port'
     */
    proxy?: string;
}
