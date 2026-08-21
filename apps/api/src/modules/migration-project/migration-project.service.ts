import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
    MigrationProjectRepository,
    MigrationRunRepository,
    ReconciliationReportRepository,
    CredentialRepository,
} from '@cdo/db';
import { MigrationProjectStatus, MigrationRunStatus, JobKind } from '@cdo/shared';
import { JobProducer } from '@cdo/queue';
import {
    CreateMigrationProjectInput,
    UpdateMigrationProjectInput,
    CreateMigrationRunInput,
} from './dto/create-migration-project.input';

/** Valid entity type values — matches EntityType enum from @cdo/shared */
const VALID_ENTITY_TYPES = new Set(['CATEGORIES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS']);

@Injectable()
export class MigrationProjectService {
    private readonly logger = new Logger(MigrationProjectService.name);

    constructor(
        private readonly projectRepository: MigrationProjectRepository,
        private readonly runRepository: MigrationRunRepository,
        private readonly reportRepository: ReconciliationReportRepository,
        private readonly credentialRepository: CredentialRepository,
        private readonly jobProducer: JobProducer,
    ) {}

    // ── MigrationProject CRUD ──────────────────────────────────────────────────

    async findAll(tenantId: string) {
        return this.projectRepository.findAllForTenant(tenantId);
    }

    async findOne(tenantId: string, id: string) {
        const project = await this.projectRepository.findOneForTenant(tenantId, id);
        if (!project) throw new NotFoundException(`MigrationProject ${id} not found`);
        return project;
    }

    async create(tenantId: string, input: CreateMigrationProjectInput) {
        // Validate entity types
        for (const et of input.entityTypes) {
            if (!VALID_ENTITY_TYPES.has(et)) {
                throw new BadRequestException(
                    `Invalid entityType: '${et}'. Valid values: ${[...VALID_ENTITY_TYPES].join(', ')}`,
                );
            }
        }
        if (input.entityTypes.length === 0) {
            throw new BadRequestException('entityTypes must contain at least one entity type');
        }

        // Verify source credential belongs to this tenant
        const source = await this.credentialRepository.findOneForTenant(
            tenantId,
            input.sourceConnectionId,
        );
        if (!source) {
            throw new NotFoundException(
                `Source connection ${input.sourceConnectionId} not found`,
            );
        }

        // Verify target credential belongs to this tenant
        const target = await this.credentialRepository.findOneForTenant(
            tenantId,
            input.targetConnectionId,
        );
        if (!target) {
            throw new NotFoundException(
                `Target connection ${input.targetConnectionId} not found`,
            );
        }

        if (input.sourceConnectionId === input.targetConnectionId) {
            throw new BadRequestException(
                'Source and target connections must be different',
            );
        }

        const project = await this.projectRepository.create({
            tenantId,
            name: input.name,
            sourceConnectionId: input.sourceConnectionId,
            targetConnectionId: input.targetConnectionId,
            entityTypes: input.entityTypes,
            mappingConfig: {},
            status: MigrationProjectStatus.DRAFT,
        });

        this.logger.log(
            `[${tenantId}] MigrationProject created — id=${project._id} name="${input.name}"`,
        );

        return project;
    }

    async update(tenantId: string, id: string, input: UpdateMigrationProjectInput) {
        const project = await this.projectRepository.findOneForTenant(tenantId, id);
        if (!project) throw new NotFoundException(`MigrationProject ${id} not found`);

        if (project.status === MigrationProjectStatus.ARCHIVED) {
            throw new BadRequestException('Cannot update an archived project');
        }

        if (input.name) {
            await this.projectRepository.updateName(tenantId, id, input.name);
        }

        if (input.mappingConfig !== undefined) {
            let parsed: Record<string, unknown>;
            try {
                parsed = JSON.parse(input.mappingConfig);
            } catch {
                throw new BadRequestException('mappingConfig must be a valid JSON string');
            }
            await this.projectRepository.updateMappingConfig(tenantId, id, parsed);
        }

        return this.projectRepository.findOneForTenant(tenantId, id);
    }

    async archive(tenantId: string, id: string): Promise<boolean> {
        const project = await this.projectRepository.findOneForTenant(tenantId, id);
        if (!project) throw new NotFoundException(`MigrationProject ${id} not found`);
        return this.projectRepository.archive(tenantId, id);
    }

    // ── MigrationRun operations ────────────────────────────────────────────────

    async findRuns(tenantId: string, migrationProjectId: string) {
        // Verify project exists for this tenant
        await this.findOne(tenantId, migrationProjectId);
        return this.runRepository.findAllForProject(tenantId, migrationProjectId);
    }

    async findRun(tenantId: string, id: string) {
        const run = await this.runRepository.findOneForTenant(tenantId, id);
        if (!run) throw new NotFoundException(`MigrationRun ${id} not found`);
        return run;
    }

    /**
     * Create a MigrationRun for a project.
     *
     * Phase 1: Creates the run document with PENDING status and initialises wave stubs.
     * The run is not yet connected to the BullMQ execution path — that wiring is Phase 2
     * (wave executor). The run record stands as the canonical execution intent.
     */
    async createRun(tenantId: string, input: CreateMigrationRunInput) {
        const project = await this.findOne(tenantId, input.migrationProjectId);

        if (project.status === MigrationProjectStatus.ARCHIVED) {
            throw new BadRequestException('Cannot run an archived project');
        }

        const correlationId = randomUUID();
        const traceId = randomUUID();

        const run = await this.runRepository.create({
            tenantId,
            migrationProjectId: input.migrationProjectId,
            status: MigrationRunStatus.PENDING,
            dryRun: input.dryRun ?? false,
            processedCount: 0,
            failedCount: 0,
            correlationId,
            traceId,
        });

        const runId = String(run._id);

        // Initialise wave stubs — one per entity type in the project, in project order
        await this.runRepository.initWaves(runId, project.entityTypes);

        // B1 Resume — copy wave cursors from a previous run into the new run's stubs.
        // Each wave in the new run starts extraction from the position where the
        // referenced run left off; the referenced run is never modified.
        if (input.resumeFromRunId) {
            // The previous run must belong to this tenant and this project.
            const previousRun = await this.runRepository.findOneForTenant(
                tenantId,
                input.resumeFromRunId,
            );
            if (!previousRun) {
                throw new NotFoundException(
                    `Resume source run ${input.resumeFromRunId} not found`,
                );
            }
            if (String(previousRun.migrationProjectId) !== input.migrationProjectId) {
                throw new BadRequestException(
                    `Run ${input.resumeFromRunId} does not belong to project ${input.migrationProjectId}`,
                );
            }

            // Fetch per-wave cursors from the previous run (only waves that have a cursor are returned).
            const waveCursors = await this.runRepository.getWaveCursors(
                tenantId,
                input.resumeFromRunId,
            );

            // Write each cursor into the corresponding wave stub of the new run.
            // updateWave uses the positional $ operator to target the correct wave entry.
            for (const [entityType, cursor] of waveCursors) {
                await this.runRepository.updateWave(runId, entityType, { cursor });
            }

            this.logger.log(
                `[${tenantId}] MigrationRun ${runId} inherited ${waveCursors.size} wave cursor(s) from ${input.resumeFromRunId}`,
            );
        }

        this.logger.log(
            `[${tenantId}] MigrationRun created — id=${runId} projectId=${input.migrationProjectId} dryRun=${input.dryRun ?? false}`,
        );

        // Enqueue the BullMQ job — worker picks this up and drives the run to completion.
        // The jobId is the runId so duplicate enqueues for the same run are deduplicated.
        await this.jobProducer.enqueueEtlJob({
            jobId: runId,
            tenantId,
            correlationId: run.correlationId ?? runId,
            traceId: run.traceId ?? runId,
            kind: JobKind.MIGRATION_RUN,
            sourceCredentialId: project.sourceConnectionId,
            targetCredentialId: project.targetConnectionId,
            entityTypes: project.entityTypes,
            migrationRunId: runId,
            dryRun: input.dryRun ?? false,
        });

        this.logger.log(
            `[${tenantId}] MigrationRun enqueued — id=${runId} kind=${JobKind.MIGRATION_RUN}`,
        );

        // Return fresh document with waves populated
        return this.runRepository.findOneForTenant(tenantId, runId);
    }

    // ── ReconciliationReport ───────────────────────────────────────────────────

    async findReport(tenantId: string, migrationRunId: string) {
        const report = await this.reportRepository.findByRunId(tenantId, migrationRunId);
        if (!report) {
            throw new NotFoundException(
                `No reconciliation report found for run ${migrationRunId}`,
            );
        }
        return report;
    }

    async findReportsForProject(tenantId: string, migrationProjectId: string) {
        await this.findOne(tenantId, migrationProjectId);
        return this.reportRepository.findAllForProject(tenantId, migrationProjectId);
    }
}
