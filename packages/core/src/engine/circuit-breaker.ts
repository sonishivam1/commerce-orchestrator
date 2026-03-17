import { ErrorType, CIRCUIT_BREAKER_THRESHOLD } from '@cdo/shared';

export interface CircuitBreakerOptions {
    failureThreshold?: number; // Consecutive failures before tripping
}

export class CircuitBreaker {
    private failureCount = 0;
    private readonly failureThreshold: number;
    private isTripped = false;

    constructor(options: CircuitBreakerOptions = {}) {
        this.failureThreshold = options.failureThreshold ?? CIRCUIT_BREAKER_THRESHOLD;
    }

    recordFailure(errorType?: ErrorType | string): void {
        // Fatal errors trip the breaker immediately
        if (errorType === ErrorType.FATAL) {
            this.trip();
            return;
        }

        // Validation errors typically don't count against global circuit breaker 
        // since they indicate bad data rather than a downstream outage.
        if (errorType === ErrorType.VALIDATION) {
            return;
        }

        // All other errors (including Transient) count as failures
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.trip();
        }
    }

    recordSuccess(): void {
        if (!this.isTripped) {
            this.failureCount = 0;
        }
    }

    check(): void {
        if (this.isTripped) {
            throw new Error(`Circuit breaker tripped: consecutive failures exceeded threshold of ${this.failureThreshold}`);
        }
    }

    trip(): void {
        this.isTripped = true;
    }

    get state(): 'OPEN' | 'CLOSED' {
        return this.isTripped ? 'OPEN' : 'CLOSED';
    }
}
