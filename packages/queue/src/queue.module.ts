/**
 * @file queue.module.ts
 * @package @cdo/queue
 *
 * NestJS BullMQ module — registers the ETL and Scrape queues against Redis.
 *
 * Import this module in the root AppModule of both the API (to produce jobs)
 * and worker apps (to consume jobs).
 *
 * Redis connection details are read from environment variables:
 * - REDIS_HOST (required)
 * - REDIS_PORT (optional, defaults to standard Redis port 6379)
 * - REDIS_PASSWORD (optional, for password-protected Redis instances)
 *
 * The app throws a clear error on startup if REDIS_HOST is not set.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_ETL, QUEUE_SCRAPE } from '@cdo/shared';
import { JobProducer } from './producers/job.producer';

/** Standard Redis port — used as fallback if REDIS_PORT is not set */
const DEFAULT_REDIS_PORT = 6379;

/**
 * Reads and validates Redis connection environment variables.
 * Throws descriptively if required variables are absent.
 */
function getRedisConfig(): { host: string; port: number; password?: string } {
    const host = process.env.REDIS_HOST;

    if (!host) {
        throw new Error(
            '[QueueModule] REDIS_HOST environment variable is not set. ' +
            'Please add it to your .env file before starting the application.',
        );
    }

    const port = process.env.REDIS_PORT
        ? parseInt(process.env.REDIS_PORT, 10)
        : DEFAULT_REDIS_PORT;

    // Password is optional — only set when Redis requires authentication
    const password = process.env.REDIS_PASSWORD || undefined;

    return { host, port, password };
}

@Module({
    imports: [
        // Register Redis connection once — shared by all queues in this module
        BullModule.forRootAsync({
            useFactory: () => ({
                connection: getRedisConfig(),
            }),
        }),

        // Register both queues so producers and consumers can inject them by name
        BullModule.registerQueue(
            { name: QUEUE_ETL },
            { name: QUEUE_SCRAPE },
        ),
    ],
    providers: [JobProducer],
    exports: [
        // Export JobProducer so API/Worker modules can inject it
        JobProducer,
        // Export BullModule so consumer modules (workers) can access queue instances
        BullModule,
    ],
})
export class QueueModule { }
