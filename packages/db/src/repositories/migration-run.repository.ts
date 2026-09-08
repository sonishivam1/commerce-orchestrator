import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MigrationRun, MigrationRunDocument, WaveRecord, FailedItem } from '../schemas/migration-run.schema';
import { MigrationRunStatus, WaveStatus } from '@cdo/shared';

@Injectable()
export class MigrationRunRepository {
    constructor(
        @InjectModel(MigrationRun.name)
        private readonly model: Model<MigrationRunDocument>,
    ) {}

    async create(data: Partial<MigrationRun>): Promise<MigrationRunDocument> {
        return this.model.create(data);
    }

    /** True when the project has a run that is PENDING or RUNNING. */
    async hasActiveRun(tenantId: string, migrationProjectId: string): Promise<boolean> {
        const count = await this.model
            .countDocuments({
                tenantId,
                migrationProjectId,
                status: { $in: [MigrationRunStatus.PENDING, MigrationRunStatus.RUNNING] },
            })
            .exec();
        return count > 0;
    }

    /** All runs for a project, newest first */
    async findAllForProject(
        tenantId: string,
        migrationProjectId: string,
    ): Promise<MigrationRunDocument[]> {
        return this.model
            .find({ tenantId, migrationProjectId })
            .sort({ createdAt: -1 })
            .exec();
    }

    /** Most recent N runs across all projects for a tenant, newest first */
    async findRecentForTenant(
        tenantId: string,
        limit: number,
    ): Promise<MigrationRunDocument[]> {
        return this.model
            .find({ tenantId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }

    async findOneForTenant(
        tenantId: string,
        id: string,
    ): Promise<MigrationRunDocument | null> {
        return this.model.findOne({ _id: id, tenantId }).exec();
    }

    async markRunning(id: string): Promise<void> {
        await this.model
            .updateOne(
                { _id: id },
                { $set: { status: MigrationRunStatus.RUNNING, startedAt: new Date() } },
            )
            .exec();
    }

    async updateProgress(id: string, processedCount: number, failedCount: number): Promise<void> {
        await this.model
            .updateOne({ _id: id }, { $set: { processedCount, failedCount } })
            .exec();
    }

    async markCompleted(id: string): Promise<void> {
        await this.model
            .updateOne(
                { _id: id },
                { $set: { status: MigrationRunStatus.COMPLETED, completedAt: new Date() } },
            )
            .exec();
    }

    /** Record the generated export file on an EXPORT-mode run. */
    async setExport(
        id: string,
        exportInfo: { filePath: string; byteSize: number; format: string },
    ): Promise<void> {
        await this.model.updateOne({ _id: id }, { $set: { export: exportInfo } }).exec();
    }

    async markFailed(id: string, errorSummary: Record<string, unknown>): Promise<void> {
        await this.model
            .updateOne(
                { _id: id },
                { $set: { status: MigrationRunStatus.FAILED, errorSummary } },
            )
            .exec();
    }

    async markCancelled(id: string): Promise<void> {
        await this.model
            .updateOne(
                { _id: id },
                { $set: { status: MigrationRunStatus.CANCELLED } },
            )
            .exec();
    }

    /**
     * Update the status and counts for a single wave within a run.
     * Used by the wave executor (Phase 2) to track per-entity-type progress.
     */
    async updateWave(
        id: string,
        entityType: string,
        update: Partial<WaveRecord>,
    ): Promise<void> {
        const setFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(update)) {
            setFields[`waves.$.${key}`] = value;
        }
        await this.model
            .updateOne(
                { _id: id, 'waves.entityType': entityType },
                { $set: setFields },
            )
            .exec();
    }

    /** Append one failed item to the run (replaces the DLQ collection). */
    async appendFailedItem(id: string, item: Omit<FailedItem, 'occurredAt'>): Promise<void> {
        await this.model
            .updateOne(
                { _id: id },
                { $push: { failedItems: { ...item, occurredAt: new Date() } } },
            )
            .exec();
    }

    /**
     * Set the PENDING wave stubs when a run is created.
     * One stub per entity type in the migration project.
     */
    async initWaves(id: string, entityTypes: string[]): Promise<void> {
        const waves: WaveRecord[] = entityTypes.map((entityType) => ({
            entityType,
            status: WaveStatus.PENDING,
            processedCount: 0,
            failedCount: 0,
        }));
        await this.model.updateOne({ _id: id }, { $set: { waves } }).exec();
    }

    /**
     * Returns a Map of entityType → cursor for all waves in a run that have a
     * persisted cursor value.  Used by the B1 resume flow to copy wave offsets
     * from a previous run into a new run at creation time.
     *
     * Scoped by tenantId — returns an empty Map when the run is not found or
     * does not belong to the tenant (no error is thrown so the caller decides).
     */
    async getWaveCursors(tenantId: string, runId: string): Promise<Map<string, string>> {
        const run = await this.model
            .findOne({ _id: runId, tenantId }, { waves: 1 })
            .exec();

        const result = new Map<string, string>();
        if (!run) return result;

        for (const wave of run.waves ?? []) {
            if (wave.cursor) result.set(wave.entityType, wave.cursor);
        }
        return result;
    }
}
