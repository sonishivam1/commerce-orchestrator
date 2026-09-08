import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { MigrationProjectService } from './migration-project.service';
import { MigrationProjectResolver } from './migration-project.resolver';

/**
 * MigrationProjectModule — owns all GQL operations for MigrationProjects,
 * MigrationRuns.
 *
 * Repositories (MigrationProjectRepository, MigrationRunRepository,
 * CredentialRepository) are provided
 * by the globally registered DatabaseModule — no re-import needed.
 *
 * QueueModule provides JobProducer so createMigrationRun can enqueue
 * the MIGRATION_RUN BullMQ job that drives wave execution.
 */
@Module({
    imports: [QueueModule],
    providers: [MigrationProjectService, MigrationProjectResolver],
})
export class MigrationProjectModule {}
