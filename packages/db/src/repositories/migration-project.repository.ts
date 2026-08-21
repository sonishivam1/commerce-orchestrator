import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MigrationProject, MigrationProjectDocument } from '../schemas/migration-project.schema';
import { MigrationProjectStatus } from '@cdo/shared';

@Injectable()
export class MigrationProjectRepository {
    constructor(
        @InjectModel(MigrationProject.name)
        private readonly model: Model<MigrationProjectDocument>,
    ) {}

    async create(data: Partial<MigrationProject>): Promise<MigrationProjectDocument> {
        return this.model.create(data);
    }

    /** List all non-archived projects for a tenant, newest first */
    async findAllForTenant(tenantId: string): Promise<MigrationProjectDocument[]> {
        return this.model
            .find({ tenantId, status: { $ne: MigrationProjectStatus.ARCHIVED } })
            .sort({ createdAt: -1 })
            .exec();
    }

    async findOneForTenant(
        tenantId: string,
        id: string,
    ): Promise<MigrationProjectDocument | null> {
        return this.model.findOne({ _id: id, tenantId }).exec();
    }

    async updateName(tenantId: string, id: string, name: string): Promise<void> {
        await this.model.updateOne({ _id: id, tenantId }, { $set: { name } }).exec();
    }

    async updateMappingConfig(
        tenantId: string,
        id: string,
        mappingConfig: Record<string, unknown>,
    ): Promise<void> {
        await this.model.updateOne({ _id: id, tenantId }, { $set: { mappingConfig } }).exec();
    }

    async updateStatus(
        tenantId: string,
        id: string,
        status: MigrationProjectStatus,
    ): Promise<void> {
        await this.model.updateOne({ _id: id, tenantId }, { $set: { status } }).exec();
    }

    async archive(tenantId: string, id: string): Promise<boolean> {
        const result = await this.model
            .updateOne(
                { _id: id, tenantId },
                { $set: { status: MigrationProjectStatus.ARCHIVED } },
            )
            .exec();
        return result.modifiedCount === 1;
    }
}
