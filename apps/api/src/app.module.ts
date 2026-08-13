import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { AuthModule as AppAuthModule } from './modules/auth/auth.module';
import { CredentialModule } from './modules/credential/credential.module';
import { JobModule } from './modules/job/job.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { DlqModule } from './modules/dlq/dlq.module';
import { HealthModule } from './modules/health/health.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';

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
 * 7. JobModule       — job lifecycle + DLQ replay
 * 8. DlqModule       — dedicated DLQ queries + delete
 * 9. HealthModule    — GET /health readiness probe
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env'],
        }),
        ThrottlerModule.forRoot([
            {
                // 100 requests per 60 seconds per client IP
                name: 'default',
                ttl: 60_000,
                limit: 100,
            },
        ]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: true,
            sortSchema: true,
            context: ({ req }: { req: Record<string, unknown> }) => ({ req }),
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
        JobModule,
        DlqModule,
        HealthModule,
    ],
    providers: [
        { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
        { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
    ],
})
export class AppModule {}
