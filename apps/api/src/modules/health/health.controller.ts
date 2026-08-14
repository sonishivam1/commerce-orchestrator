import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MongooseHealthIndicator,
} from '@nestjs/terminus';

/**
 * GET /health — liveness + readiness probe
 *
 * Checks:
 * - MongoDB connection (via Mongoose ping)
 *
 * Returns 200 { status: 'ok' } when all checks pass.
 * Returns 503 when any check fails — suitable for Kubernetes readiness probes.
 */
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly db: MongooseHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.db.pingCheck('mongodb'),
        ]);
    }
}
