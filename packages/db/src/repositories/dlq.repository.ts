import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DlqItem, DlqItemDocument } from '../schemas/dlq.schema';

@Injectable()
export class DlqRepository {
    constructor(@InjectModel(DlqItem.name) private readonly model: Model<DlqItemDocument>) {}

    async create(data: Partial<DlqItem>): Promise<DlqItemDocument> {
        return this.model.create(data);
    }

    async findAllForJob(tenantId: string, jobId: string): Promise<DlqItemDocument[]> {
        return this.model.find({ tenantId, jobId }).sort({ createdAt: -1 }).exec();
    }

    async findOneForTenant(tenantId: string, id: string): Promise<DlqItemDocument | null> {
        return this.model.findOne({ _id: id, tenantId }).exec();
    }

    async findReplayableItems(tenantId: string, jobId: string): Promise<DlqItemDocument[]> {
        return this.model
            .find({ tenantId, jobId, canReplay: true, replayed: { $ne: true } })
            .exec();
    }

    async markReplayed(id: string): Promise<void> {
        await this.model.updateOne({ _id: id }, { $set: { replayed: true, replayedAt: new Date() } }).exec();
    }

    async countPendingForJob(tenantId: string, jobId: string): Promise<number> {
        return this.model.countDocuments({ tenantId, jobId, replayed: { $ne: true } }).exec();
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const result = await this.model.deleteOne({ _id: id, tenantId }).exec();
        return result.deletedCount === 1;
    }
}
