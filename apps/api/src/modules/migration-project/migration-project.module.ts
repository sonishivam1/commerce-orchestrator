import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { MigrationProjectService } from './migration-project.service';
import { MigrationProjectResolver } from './migration-project.resolver';
import { ExportController } from './export.controller';

/**
 * MigrationProjectModule — GraphQL operations for MigrationProjects and
 * MigrationRuns, plus the REST endpoint that serves EXPORT-run files.
 *
 * Repositories (MigrationProjectRepository, MigrationRunRepository,
 * CredentialRepository) come from the global DatabaseModule.
 * QueueModule provides JobProducer so createMigrationRun can enqueue the
 * MIGRATION_RUN BullMQ job.
 */
@Module({
    imports: [QueueModule],
    controllers: [ExportController],
    providers: [MigrationProjectService, MigrationProjectResolver],
})
export class MigrationProjectModule {}
