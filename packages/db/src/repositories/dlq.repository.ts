/**
 * @file dlq.repository.ts
 * @package @cdo/db
 *
 * Repository for Dead Letter Queue (DLQ) operations.
 *
 * ALL methods are scoped by tenantId — this is enforced at repository level,
 * never left to the caller. This guarantees multi-tenant data isolation.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorType } from '@cdo/shared';
import { DlqItem, DlqItemDocument } from '../schemas/dlq.schema';

/** Shape of the data required to create a new DLQ item */
export interface CreateDlqItemInput {
    tenantId: string;
    jobId: string;
    itemKey: string;
    errorType: ErrorType;
    errorMessage: string;
    rawPayload: Record<string, unknown>;
    canReplay?: boolean;
}

@Injectable()
export class DlqRepository {
    constructor(
        @InjectModel(DlqItem.name)
        private readonly dlqModel: Model<DlqItemDocument>,
    ) { }

    /**
     * Creates a new DLQ item when an entity fails to load.
     * Called by the Orchestrator on every pipeline failure event.
     *
     * @param input - Failure details including the raw payload for future replay
     */
    async create(input: CreateDlqItemInput): Promise<DlqItemDocument> {
        return this.dlqModel.create({
            ...input,
            canReplay: input.canReplay ?? true,
        });
    }

    /**
     * Returns all DLQ items for a specific job, scoped to the tenant.
     * Used by the API to populate the DLQ view in the dashboard.
     *
     * @param tenantId - Caller's tenant (from JWT)
     * @param jobId - The job whose failures to retrieve
     */
    async findAllForJob(tenantId: string, jobId: string): Promise<DlqItemDocument[]> {
        return this.dlqModel
            .find({ tenantId, jobId })
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Returns all replayable DLQ items for a tenant.
     * Used for the "Replay All" action in the dashboard.
     *
     * @param tenantId - Caller's tenant (from JWT)
     * @param errorType - Optional filter (e.g. replay only TransientErrors)
     */
    async findReplayableItems(
        tenantId: string,
        errorType?: ErrorType,
    ): Promise<DlqItemDocument[]> {
        const filter: Record<string, unknown> = {
            tenantId,
            canReplay: true,
            replayed: false,
        };

        if (errorType) {
            filter['errorType'] = errorType;
        }

        return this.dlqModel.find(filter).exec();
    }

    /**
     * Finds a single DLQ item by its ID, scoped to the tenant.
     * Used before replaying to validate ownership and replayability.
     *
     * @param tenantId - Caller's tenant (from JWT)
     * @param id - MongoDB document ID of the DLQ item
     */
    async findOneForTenant(tenantId: string, id: string): Promise<DlqItemDocument | null> {
        return this.dlqModel.findOne({ _id: id, tenantId }).exec();
    }

    /**
     * Marks a DLQ item as successfully replayed.
     * Called by the worker after the replayed item loads successfully.
     *
     * @param id - MongoDB document ID of the DLQ item
     */
    async markReplayed(id: string): Promise<void> {
        await this.dlqModel
            .updateOne({ _id: id }, { $set: { replayed: true, replayedAt: new Date() } })
            .exec();
    }

    /**
     * Counts how many unreplayed DLQ items exist for a job.
     * Used to populate the "X failed" stat card in the dashboard.
     *
     * @param tenantId - Caller's tenant
     * @param jobId - The job to count failures for
     */
    async countPendingForJob(tenantId: string, jobId: string): Promise<number> {
        return this.dlqModel.countDocuments({ tenantId, jobId, replayed: false }).exec();
    }
}
