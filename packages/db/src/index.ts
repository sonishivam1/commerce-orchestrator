/**
 * @package @cdo/db
 * Public API — import from '@cdo/db', not from individual files.
 */

// NestJS Module (import once in root AppModule)
export * from './database.module';

// Mongoose Schemas — Legacy (Job-centric)
export * from './schemas/job.schema';
export * from './schemas/credential.schema';
export * from './schemas/tenant.schema';
export * from './schemas/dlq.schema';

// Mongoose Schemas — Migration domain (Phase 1)
export * from './schemas/migration-project.schema';
export * from './schemas/migration-run.schema';
export * from './schemas/identity-map.schema';
export * from './schemas/reconciliation-report.schema';

// Repositories — Legacy
export * from './repositories/job.repository';
export * from './repositories/credential.repository';
export * from './repositories/tenant.repository';
export * from './repositories/dlq.repository';

// Repositories — Migration domain (Phase 1)
export * from './repositories/migration-project.repository';
export * from './repositories/migration-run.repository';
export * from './repositories/identity-map.repository';
export * from './repositories/reconciliation-report.repository';
