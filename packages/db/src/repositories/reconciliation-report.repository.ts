import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    ReconciliationReport,
    ReconciliationReportDocument,
    EntityReconciliationSummary,
} from '../schemas/reconciliation-report.schema';

@Injectable()
export class ReconciliationReportRepository {
    constructor(
        @InjectModel(ReconciliationReport.name)
        private readonly model: Model<ReconciliationReportDocument>,
    ) {}

    async create(data: {
        tenantId: string;
        migrationRunId: string;
        migrationProjectId: string;
        generatedAt: Date;
        overallSuccessRate: number;
        entitySummaries: EntityReconciliationSummary[];
    }): Promise<ReconciliationReportDocument> {
        return this.model.create(data);
    }

    /** Get the report for a specific run — at most one per run (unique index on migrationRunId) */
    async findByRunId(
        tenantId: string,
        migrationRunId: string,
    ): Promise<ReconciliationReportDocument | null> {
        return this.model.findOne({ tenantId, migrationRunId }).exec();
    }

    /** Most-recent report for a project (all runs combined, sorted newest first) */
    async findLatestForProject(
        tenantId: string,
        migrationProjectId: string,
    ): Promise<ReconciliationReportDocument | null> {
        return this.model
            .findOne({ tenantId, migrationProjectId })
            .sort({ generatedAt: -1 })
            .exec();
    }

    /** All reports for a project — useful for a history view */
    async findAllForProject(
        tenantId: string,
        migrationProjectId: string,
    ): Promise<ReconciliationReportDocument[]> {
        return this.model
            .find({ tenantId, migrationProjectId })
            .sort({ generatedAt: -1 })
            .exec();
    }
}
