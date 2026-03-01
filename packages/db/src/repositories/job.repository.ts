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

    async updateProgress(id: string, processedCount: number, failedCount: number): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { processedCount, failedCount } }).exec();
    }

    async markCompleted(id: string): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { status: 'COMPLETED', completedAt: new Date() } }).exec();
    }

    async markFailed(id: string, errorSummary: Record<string, unknown>): Promise<void> {
        await this.jobModel.updateOne({ _id: id }, { $set: { status: 'FAILED', errorSummary } }).exec();
    }
}
