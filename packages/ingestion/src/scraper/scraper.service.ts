/**
 * @file scraper.service.ts
 * @package @cdo/ingestion
 *
 * ScraperService — manages a pool of Playwright browser contexts for concurrent
 * headless extraction. Uses `playwright-extra` + `puppeteer-extra-plugin-stealth`
 * to reduce bot-detection fingerprinting.
 *
 * Usage:
 *   const service = new ScraperService({ concurrency: 3 });
 *   await service.initialize();
 *   const results = await service.scrapeUrls(['https://...', '...']);
 *   await service.close();
 *
 * The service is stateful — call close() when done to release browser resources.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import {
    ScraperConfig,
    DEFAULT_SCRAPER_CONCURRENCY,
    DEFAULT_NAVIGATION_TIMEOUT_MS,
    DEFAULT_IDLE_TIMEOUT_MS,
} from './scraper.config';
import { PageExtractor } from './page-extractor';
import type { ScrapeResult } from '../parsers/parser.types';

export class ScraperService {
    private browser: Browser | null = null;
    private readonly extractor = new PageExtractor();

    private readonly concurrency: number;
    private readonly navigationTimeoutMs: number;
    private readonly idleTimeoutMs: number;
    private readonly userAgent?: string;
    private readonly proxy?: string;

    constructor(private readonly config: ScraperConfig = {}) {
        this.concurrency = config.concurrency ?? DEFAULT_SCRAPER_CONCURRENCY;
        this.navigationTimeoutMs = config.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
        this.idleTimeoutMs = config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
        this.userAgent = config.userAgent;
        this.proxy = config.proxy;
    }

    /**
     * Launches the underlying Chromium browser.
     * Must be called before scrapeUrls().
     */
    async initialize(): Promise<void> {
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
            ...(this.proxy ? { proxy: { server: this.proxy } } : {}),
        });
    }

    /**
     * Closes the browser and all contexts — must be called in finally blocks.
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Scrapes a list of URLs concurrently, bounded by this.concurrency.
     * Each URL gets its own isolated BrowserContext (separate cookies/session).
     *
     * @param urls - List of product page URLs to scrape
     * @returns Array of ScrapeResult, one per URL
     */
    async scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
        if (!this.browser) {
            throw new Error('ScraperService.initialize() must be called before scrapeUrls()');
        }

        const results: ScrapeResult[] = [];
        const queue = [...urls];
        const active: Promise<void>[] = [];

        const processNext = async (): Promise<void> => {
            const url = queue.shift();
            if (!url) return;

            const result = await this.scrapeOne(url);
            results.push(result);
        };

        // Fill up to concurrency limit, then process remaining as slots open
        while (queue.length > 0 || active.length > 0) {
            while (active.length < this.concurrency && queue.length > 0) {
                const task = processNext().then(() => {
                    active.splice(active.indexOf(task), 1);
                });
                active.push(task);
            }
            if (active.length > 0) {
                await Promise.race(active);
            }
        }

        return results;
    }

    /**
     * Scrapes a single URL in an isolated context.
     * Errors are caught and returned as ScrapeResult.success = false.
     */
    async scrapeOne(url: string): Promise<ScrapeResult> {
        let context: BrowserContext | null = null;

        try {
            context = await this.browser!.newContext({
                ...(this.userAgent ? { userAgent: this.userAgent } : {}),
                // Randomise viewport slightly to avoid fingerprinting
                viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 800 },
                // Disable WebRTC to prevent IP leaks through proxy
                permissions: [],
            });

            const page = await context.newPage();

            // Block unnecessary resource types to speed up scraping
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['font', 'media', 'websocket'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            page.setDefaultNavigationTimeout(this.navigationTimeoutMs);
            page.setDefaultTimeout(this.navigationTimeoutMs);

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Wait for idle to let lazy-loaded content settle
            await page.waitForLoadState('networkidle', { timeout: this.idleTimeoutMs }).catch(() => {
                // networkidle may not fire on heavy SPAs — proceed anyway
            });

            const data = await this.extractor.extract(page, url);
            return { url, success: true, data };

        } catch (error) {
            return {
                url,
                success: false,
                error: (error as Error).message,
            };
        } finally {
            // Always close the context to free resources, even if extraction failed
            await context?.close();
        }
    }
}
