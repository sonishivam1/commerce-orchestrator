import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { AuthModule as AppAuthModule } from './modules/auth/auth.module';
import { CredentialModule } from './modules/credential/credential.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { HealthModule } from './modules/health/health.module';
import { MigrationProjectModule } from './modules/migration-project/migration-project.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RedisThrottlerModule } from './common/storage/redis-throttler.module';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';

/**
 * Root application module.
 *
 * Import order:
 * 1. DatabaseModule  — @Global(), provides all repositories
 * 2. QueueModule     — provides JobProducer
 * 3. ThrottlerModule — 100 req/min per tenant
 * 4. AppAuthModule   — login resolver + JWT strategy
 * 5. TenantModule    — registration + profile
 * 6. CredentialModule — encrypted credential CRUD
 * 7. DlqModule       — dedicated DLQ queries + delete
 * 8. HealthModule    — GET /health liveness probe (simple, no external deps)
 * 9. MigrationProjectModule — migration/export projects + runs
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // Search order (first match wins):
            //   1. ".env"      — found when CWD is the workspace root (Turborepo default)
            //   2. "../../.env" — found when CWD is apps/api (direct nest start)
            // Both paths point to the same root .env file.
            envFilePath: ['.env', '../../.env'],
        }),
        ThrottlerModule.forRootAsync({
            // RedisThrottlerModule provides + exports RedisThrottlerStorage
            imports: [RedisThrottlerModule],
            inject:  [RedisThrottlerStorage],
            useFactory: (storage: RedisThrottlerStorage) => ({
                // 100 requests per 60 seconds per tenant (or per IP for
                // unauthenticated endpoints). Redis-backed so limits are
                // shared across all API replicas.
                storage,
                throttlers: [
                    { name: 'default', ttl: 60_000, limit: 100 },
                ],
            }),
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: true,
            sortSchema: true,
            context: ({ req, res }: { req: any; res: any }) => ({ req, res }),
            formatError: (error) => ({
                message: error.message,
                code: error.extensions?.code,
                path: error.path,
            }),
        }),
        DatabaseModule,
        QueueModule,
        AppAuthModule,
        TenantModule,
        CredentialModule,
        HealthModule,
        MigrationProjectModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
        { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    ],
})
export class AppModule {}
