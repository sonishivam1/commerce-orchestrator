/**
 * @package @cdo/auth
 * Public API — import from '@cdo/auth', not from individual files.
 */

// NestJS Module (import in root AppModule of API app)
export * from './auth.module';

// Guards (use with @UseGuards() on resolvers)
export * from './guards/gql-auth.guard';

// Decorators (use with @CurrentTenant() in resolver arguments)
export * from './decorators/current-tenant.decorator';

// Strategies (registered automatically when AuthModule is imported)
export * from './strategies/jwt.strategy';
