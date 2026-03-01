/**
 * ScraperService — wraps Playwright cluster for headless HTML extraction.
 * This is a stub. Real implementation uses playwright-cluster for concurrency.
 */
export class ScraperService {
    async scrape(url: string): Promise<Record<string, unknown>[]> {
        // TODO: Launch Playwright cluster with stealth plugin
        // TODO: Navigate to url, extract structured data from DOM
        // TODO: Return flat array of JSON objects for Normalization layer
        throw new Error(`ScraperService.scrape(${url}) not implemented`);
    }
}
