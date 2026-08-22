import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * GET /health — liveness probe
 *
 * Returns 200 { status: 'ok' } when the API process is alive.
 * @SkipThrottle keeps the rate-limit guard from interfering with health checks.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
    @Get()
    check() {
        return { status: 'ok', checks: { api: 'ok' } };
    }
}
