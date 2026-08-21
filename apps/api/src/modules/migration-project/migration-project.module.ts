import { Module } from '@nestjs/common';
import { MigrationProjectService } from './migration-project.service';
import { MigrationProjectResolver } from './migration-project.resolver';

/**
 * MigrationProjectModule — owns all GQL operations for MigrationProjects,
 * MigrationRuns, and ReconciliationReports.
 *
 * Repositories (MigrationProjectRepository, MigrationRunRepository,
 * ReconciliationReportRepository, CredentialRepository) are provided
 * by the globally registered DatabaseModule — no re-import needed.
 */
@Module({
    providers: [MigrationProjectService, MigrationProjectResolver],
})
export class MigrationProjectModule {}
