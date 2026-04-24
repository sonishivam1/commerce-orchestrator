import { ErrorType } from '@cdo/shared';

export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: any) => boolean;
}

/**
 * Exponential backoff sleep utility
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => (globalThis as any).setTimeout(resolve, ms));

/**
 * Executes a Promise-returning operation with exponential backoff on retries.
 * Defaults to retrying unless the error is explicitly FATAL or VALIDATION.
 */
export const withRetry = async <T>(
    operation: (attempt: number) => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 1000;
    
    // Default: Don't retry fatal/validation, retry transient/unknown
    const defaultShouldRetry = (err: any) => {
        const type = err?.type;
        return type !== ErrorType.FATAL && type !== ErrorType.VALIDATION;
    };
    
    const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

    let attempt = 0;
    while (true) {
        try {
            return await operation(attempt);
        } catch (error: any) {
            if (!shouldRetry(error)) {
                throw error;
            }

            if (attempt >= maxRetries) {
                // If it has a type, keep it, otherwise maybe tag it as TRANSIENT to signify it hit max retries?
                throw error;
            }

            attempt++;
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
};
