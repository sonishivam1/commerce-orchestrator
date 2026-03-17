import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { mapScrapedProduct } from '@cdo/mapping';
import { ScraperService } from '../scraper/scraper.service';
import { parseRawProduct } from '../parsers/product.parser';

export class ScrapeSourceConnector implements SourceConnector<CanonicalProduct> {
    private scraperService: ScraperService | null = null;
    private sourceUrl: string | null = null;
    
    constructor() {}

    /**
     * Initializes the scraper. Scrape jobs pass the target URL in the credentials object
     * because the SourceConnector interface assumes an API connection payload.
     */
    async initialize(credentials: Record<string, unknown>): Promise<void> {
        if (!credentials.sourceUrl || typeof credentials.sourceUrl !== 'string') {
            throw new Error('[ScrapeSourceConnector] sourceUrl is required in initialization payload');
        }
        this.sourceUrl = credentials.sourceUrl;
        
        // Configuration: Could optionally be passed down from credentials
        this.scraperService = new ScraperService({
            concurrency: typeof credentials.concurrency === 'number' ? credentials.concurrency : undefined,
        });
        
        await this.scraperService.initialize();
    }

    /**
     * Yields the scraped items as a CanonicalProduct batch.
     * Currently scrapes only the single initial URL.
     * Over time, this can be expanded to follow pagination links (using the cursor).
     */
    async *extract(_cursor?: string): AsyncIterableIterator<CanonicalProduct[]> {
        if (!this.scraperService || !this.sourceUrl) {
            throw new Error('[ScrapeSourceConnector] Not initialized');
        }

        try {
            // Run the Playwright scrape on the single entry URL
            const results = await this.scraperService.scrapeUrls([this.sourceUrl]);
            
            const batch: CanonicalProduct[] = [];
            
            for (const res of results) {
                if (!res.success || !res.data) {
                    console.warn(`[ScrapeSourceConnector] Extraction failed for url: ${res.url}. Error: ${res.error}`);
                    continue; // Skip failed URLs to avoid crashing the whole job
                }
                
                // 1. Convert DOM output into ScrapedProductInput
                const parsedInput = parseRawProduct(res.data);
                
                // 2. Pass through @cdo/mapping business rules to produce CanonicalProduct
                const canonical = mapScrapedProduct(parsedInput);
                
                batch.push(canonical);
            }
            
            // Yield the batch to the ETL Engine
            if (batch.length > 0) {
                yield batch;
            }
            
        } finally {
            // Clean up Playwright resources
            await this.scraperService.close();
            this.scraperService = null;
        }
    }
}
