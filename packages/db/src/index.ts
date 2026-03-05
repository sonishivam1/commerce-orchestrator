/**
 * @package @cdo/db
 * Public API — import from '@cdo/db', not from individual files.
 */

// NestJS Module (import once in root AppModule)
export * from './database.module';

// Mongoose Schemas
export * from './schemas/job.schema';
export * from './schemas/credential.schema';
export * from './schemas/tenant.schema';
export * from './schemas/dlq.schema';

// Repositories (injectable services)
export * from './repositories/job.repository';
export * from './repositories/credential.repository';
export * from './repositories/tenant.repository';
export * from './repositories/dlq.repository';
