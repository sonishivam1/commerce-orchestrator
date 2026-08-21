import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard, CurrentTenant, TenantContext } from '@cdo/auth';
import { MigrationProjectService } from './migration-project.service';
import { MigrationProjectType } from './dto/migration-project.type';
import { MigrationRunType } from './dto/migration-run.type';
import { ReconciliationReportType } from './dto/reconciliation-report.type';
import {
    CreateMigrationProjectInput,
    UpdateMigrationProjectInput,
    CreateMigrationRunInput,
} from './dto/create-migration-project.input';

@Resolver(() => MigrationProjectType)
export class MigrationProjectResolver {
    constructor(private readonly service: MigrationProjectService) {}

    // ── MigrationProject Queries ───────────────────────────────────────────────

    @Query(() => [MigrationProjectType], {
        description: 'List all non-archived migration projects for the current tenant.',
    })
    @UseGuards(GqlAuthGuard)
    migrationProjects(@CurrentTenant() tenant: TenantContext) {
        return this.service.findAll(tenant.tenantId);
    }

    @Query(() => MigrationProjectType, {
        nullable: true,
        description: 'Get a single migration project by ID.',
    })
    @UseGuards(GqlAuthGuard)
    migrationProject(
        @Args('id', { type: () => ID }) id: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.findOne(tenant.tenantId, id);
    }

    // ── MigrationProject Mutations ─────────────────────────────────────────────

    @Mutation(() => MigrationProjectType, {
        description:
            'Create a new migration project linking a source and target connection with entity types and optional mapping config.',
    })
    @UseGuards(GqlAuthGuard)
    createMigrationProject(
        @Args('input') input: CreateMigrationProjectInput,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.create(tenant.tenantId, input);
    }

    @Mutation(() => MigrationProjectType, {
        nullable: true,
        description: 'Update the name or mapping config of an existing migration project.',
    })
    @UseGuards(GqlAuthGuard)
    updateMigrationProject(
        @Args('id', { type: () => ID }) id: string,
        @Args('input') input: UpdateMigrationProjectInput,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.update(tenant.tenantId, id, input);
    }

    @Mutation(() => Boolean, {
        description: 'Archive a migration project (soft delete). The project and its runs are preserved.',
    })
    @UseGuards(GqlAuthGuard)
    archiveMigrationProject(
        @Args('id', { type: () => ID }) id: string,
        @CurrentTenant() tenant: TenantContext,
    ): Promise<boolean> {
        return this.service.archive(tenant.tenantId, id);
    }

    // ── MigrationRun Queries ───────────────────────────────────────────────────

    @Query(() => [MigrationRunType], {
        description: 'List all runs for a migration project, newest first.',
    })
    @UseGuards(GqlAuthGuard)
    migrationRuns(
        @Args('migrationProjectId', { type: () => ID }) migrationProjectId: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.findRuns(tenant.tenantId, migrationProjectId);
    }

    @Query(() => MigrationRunType, {
        nullable: true,
        description: 'Get a single migration run by ID.',
    })
    @UseGuards(GqlAuthGuard)
    migrationRun(
        @Args('id', { type: () => ID }) id: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.findRun(tenant.tenantId, id);
    }

    // ── MigrationRun Mutations ─────────────────────────────────────────────────

    @Mutation(() => MigrationRunType, {
        description:
            'Create a new migration run for a project. Returns the run with PENDING status and initialised wave stubs. ' +
            'Phase 1: execution wiring to the worker queue is Phase 2.',
    })
    @UseGuards(GqlAuthGuard)
    createMigrationRun(
        @Args('input') input: CreateMigrationRunInput,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.createRun(tenant.tenantId, input);
    }

    // ── ReconciliationReport Queries ───────────────────────────────────────────

    @Query(() => ReconciliationReportType, {
        nullable: true,
        description: 'Get the reconciliation report for a specific migration run.',
    })
    @UseGuards(GqlAuthGuard)
    reconciliationReport(
        @Args('migrationRunId', { type: () => ID }) migrationRunId: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.findReport(tenant.tenantId, migrationRunId);
    }

    @Query(() => [ReconciliationReportType], {
        description: 'Get all reconciliation reports for a migration project, newest first.',
    })
    @UseGuards(GqlAuthGuard)
    reconciliationReports(
        @Args('migrationProjectId', { type: () => ID }) migrationProjectId: string,
        @CurrentTenant() tenant: TenantContext,
    ) {
        return this.service.findReportsForProject(tenant.tenantId, migrationProjectId);
    }
}
