import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument } from '../schemas/job.schema';

@Injectable()
export class JobRepository {
    constructor(@InjectModel(Job.name) private readonly jobModel: Model<JobDocument>) { }

    async create(data: Partial<Job>): Promise<JobDocument> {
        return this.jobModel.create(data);
    }

    async findAllForTenant(tenantId: string): Promise<JobDocument[]> {
        return this.jobModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
    }

    async findOneForTenant(tenantId: string, id: string): Promise<JobDocument | null> {
        return this.jobModel.findOne({ _id: id, tenantId }).exec();
    }

    async markRunning(id: string): Promise<void> {
        await this.jobModel.updateOne(
            { _id: id },
            { $set: { status: 'RUNNING', startedAt: new Date() } }
        ).exec();
    }

    async updateProgress(id: string, processedCount: number, failedCount: number): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { processedCount, failedCount } }).exec();
    }

    async updateStatus(tenantId: string, id: string, status: string): Promise<void> {
        await this.jobModel.updateOne({ _id: id, tenantId }, { $set: { status } }).exec();
    }

    async markCompleted(id: string): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { status: 'COMPLETED', completedAt: new Date() } }).exec();
    }

    async markFailed(id: string, errorSummary: Record<string, unknown>): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { status: 'FAILED', errorSummary } }).exec();
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const result = await this.jobModel.deleteOne({ _id: id, tenantId }).exec();
        return result.deletedCount === 1;
    }
}
