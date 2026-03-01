import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from '../schemas/tenant.schema';

@Injectable()
export class TenantRepository {
    constructor(@InjectModel(Tenant.name) private readonly model: Model<TenantDocument>) { }

    async create(data: Partial<Tenant>): Promise<TenantDocument> {
        return this.model.create(data);
    }

    async findByEmail(email: string): Promise<TenantDocument | null> {
        return this.model.findOne({ email }).exec();
    }

    async findById(id: string): Promise<TenantDocument | null> {
        return this.model.findById(id).exec();
    }
}
