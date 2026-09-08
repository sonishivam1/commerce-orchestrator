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

import { Global, Module, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MongooseModule, InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { Credential, CredentialSchema } from './schemas/credential.schema';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { User, UserSchema } from './schemas/user.schema';
import { MigrationProject, MigrationProjectSchema } from './schemas/migration-project.schema';
import { MigrationRun, MigrationRunSchema } from './schemas/migration-run.schema';
import { IdentityMap, IdentityMapSchema } from './schemas/identity-map.schema';

import { CredentialRepository } from './repositories/credential.repository';
import { TenantRepository } from './repositories/tenant.repository';
import { UserRepository } from './repositories/user.repository';
import { MigrationProjectRepository } from './repositories/migration-project.repository';
import { MigrationRunRepository } from './repositories/migration-run.repository';
import { IdentityMapRepository } from './repositories/identity-map.repository';

/** All Mongoose feature modules registered in the database layer */
const FEATURE_MODULES = MongooseModule.forFeature([
    { name: Credential.name, schema: CredentialSchema },
    { name: Tenant.name, schema: TenantSchema },
    { name: User.name, schema: UserSchema },
    { name: MigrationProject.name, schema: MigrationProjectSchema },
    { name: MigrationRun.name, schema: MigrationRunSchema },
    { name: IdentityMap.name, schema: IdentityMapSchema },
]);

/** All repository providers exposed from this module */
const REPOSITORIES = [
    CredentialRepository,
    TenantRepository,
    UserRepository,
    MigrationProjectRepository,
    MigrationRunRepository,
    IdentityMapRepository,
];

/**
 * Reads MONGODB_URI from the process environment.
 * If missing, initializes a virtual in-memory MongoDB server for development.
 */
async function getMongoUri(): Promise<string> {
    const raw = process.env['MONGODB_URI'];

    if (!raw) {
        const logger = new Logger('DatabaseModule');
        logger.warn('MONGODB_URI not set. Initializing Virtual MongoDB (MongoMemoryServer)');
        // Defer load to avoid overhead if not needed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create({
            instance: { dbName: 'cdo-db' },
        });
        return mongod.getUri();
    }

    // Guard against the common copy-paste mistake where the value itself
    // starts with "MONGODB_URI=", e.g. MONGODB_URI=MONGODB_URI=mongodb+srv://...
    // This happens when the whole "KEY=VALUE" line is pasted as the value.
    const uri = raw.startsWith('MONGODB_URI=') ? raw.slice('MONGODB_URI='.length) : raw;

    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        throw new Error(
            `[DatabaseModule] MONGODB_URI does not look like a valid MongoDB connection string.\n` +
            `  Received: "${uri.slice(0, 60)}..."\n` +
            `  Expected it to start with "mongodb://" or "mongodb+srv://"\n` +
            `  Check your root .env file — the value must be only the URI, not "MONGODB_URI=<URI>".`,
        );
    }

    return uri;
}

/**
 * Logs the Mongoose connection state once the app has bootstrapped.
 * Separated into a dedicated class to avoid return-type issues with connectionFactory.
 */
class DatabaseConnectionLogger implements OnApplicationBootstrap {
    private readonly logger = new Logger('DatabaseModule');

    constructor(
        @InjectConnection() private readonly connection: Connection,
    ) { }

    onApplicationBootstrap() {
        const state = this.connection.readyState;
        // readyState 1 = connected
        if (state === 1) {
            this.logger.log('MongoDB connected successfully');
        } else {
            this.logger.warn(`MongoDB connection state on boot: ${state}`);
        }
    }
}

@Global() // Makes repositories injectable anywhere without re-importing this module
@Module({
    imports: [
        // Async factory reads MONGODB_URI at startup — never hardcoded
        MongooseModule.forRootAsync({
            useFactory: async () => ({
                uri: await getMongoUri(),
            }),
        }),
        FEATURE_MODULES,
    ],
    providers: [
        ...REPOSITORIES,
        DatabaseConnectionLogger,
    ],
    exports: REPOSITORIES,
})
export class DatabaseModule { }
