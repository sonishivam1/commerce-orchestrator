/**
 * @package @cdo/db
 * Public API — import from '@cdo/db', not from individual files.
 */

// NestJS Module (import once in root AppModule)
export * from './database.module';

// Mongoose Schemas
export * from './schemas/credential.schema';
export * from './schemas/tenant.schema';
export * from './schemas/migration-project.schema';
export * from './schemas/migration-run.schema';
export * from './schemas/identity-map.schema';

// Repositories
export * from './repositories/credential.repository';
export * from './repositories/tenant.repository';
export * from './repositories/migration-project.repository';
export * from './repositories/migration-run.repository';
export * from './repositories/identity-map.repository';
