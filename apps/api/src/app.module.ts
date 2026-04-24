import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { AuthModule as AppAuthModule } from './modules/auth/auth.module';
import { CredentialModule } from './modules/credential/credential.module';
import { JobModule } from './modules/job/job.module';
import { TenantModule } from './modules/tenant/tenant.module';

/**
 * Root application module.
 *
 * Import order matters:
 * 1. DatabaseModule  — @Global(), provides all repositories (must come first)
 * 2. QueueModule     — provides JobProducer (imported again per-feature where needed)
 * 3. AppAuthModule   — resolvers + services for login; internally imports @cdo/auth & TenantModule
 * 4. TenantModule    — registration/profile; internally imports @cdo/auth for JwtService
 * 5. CredentialModule — CRUD for encrypted credentials
 * 6. JobModule       — job creation & DLQ; internally imports QueueModule
 *
 * @cdo/auth (CoreAuthModule) is NOT imported at the root level to avoid double-registration.
 * It is imported exactly once inside AppAuthModule and TenantModule respectively.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env'],
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: true,
            sortSchema: true,
            context: ({ req }: { req: Record<string, unknown> }) => ({ req }),
        }),
        DatabaseModule,
        QueueModule,
        AppAuthModule,
        TenantModule,
        CredentialModule,
        JobModule,
    ],
})
export class AppModule { }
