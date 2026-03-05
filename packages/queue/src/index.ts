/**
 * @package @cdo/queue
 * Public API — import from '@cdo/queue', not from individual files.
 */

// NestJS Module (import in root AppModule of API and Worker apps)
export * from './queue.module';

// Producer (inject into services that need to enqueue jobs)
export * from './producers/job.producer';
