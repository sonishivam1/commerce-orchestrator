/**
 * @file database.module.ts
 * @package @cdo/db
 *
 * Global NestJS Mongoose module.
 *
 * Import this module ONCE in the root AppModule of each app (API, Worker).
 * Because it is `@Global()`, all other modules can inject repositories
 * without re-importing DatabaseModule themselves.
 *
 * Connection string is read from the MONGODB_URI environment variable.
 * The app will throw a clear error on startup if MONGODB_URI is not set —
 * this is intentional (fail fast, not silently).
 */

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Job, JobSchema } from './schemas/job.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { DlqItem, DlqItemSchema } from './schemas/dlq.schema';

import { JobRepository } from './repositories/job.repository';
import { CredentialRepository } from './repositories/credential.repository';
import { TenantRepository } from './repositories/tenant.repository';
import { DlqRepository } from './repositories/dlq.repository';

/** All Mongoose feature modules registered in the database layer */
const FEATURE_MODULES = MongooseModule.forFeature([
    { name: Job.name, schema: JobSchema },
    { name: Credential.name, schema: CredentialSchema },
    { name: Tenant.name, schema: TenantSchema },
    { name: DlqItem.name, schema: DlqItemSchema },
]);

/** All repository providers exposed from this module */
const REPOSITORIES = [
    JobRepository,
    CredentialRepository,
    TenantRepository,
    DlqRepository,
];

/**
 * Reads MONGODB_URI from the environment.
 * Throws a descriptive error instead of connecting with an undefined URI.
 */
function getMongoUri(): string {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error(
            '[DatabaseModule] MONGODB_URI environment variable is not set. ' +
            'Please add it to your .env file before starting the application.',
        );
    }

    return uri;
}

@Global() // Makes repositories injectable anywhere without re-importing this module
@Module({
    imports: [
        // Async factory reads MONGODB_URI at startup — never hardcoded
        MongooseModule.forRootAsync({
            useFactory: () => ({
                uri: getMongoUri(),
                // Log when connection is established or lost
                connectionFactory: (connection) => {
                    connection.on('connected', () =>
                        console.log('[DatabaseModule] MongoDB connected successfully'),
                    );
                    connection.on('disconnected', () =>
                        console.warn('[DatabaseModule] MongoDB connection lost'),
                    );
                    return connection;
                },
            }),
        }),
        FEATURE_MODULES,
    ],
    providers: REPOSITORIES,
    exports: REPOSITORIES,
})
export class DatabaseModule { }
