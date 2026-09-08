import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UserRepository {
    constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

    async create(data: Partial<User>): Promise<UserDocument> {
        return this.model.create(data);
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.model.findOne({ email: email.toLowerCase().trim() }).exec();
    }

    async findById(id: string): Promise<UserDocument | null> {
        return this.model.findById(id).exec();
    }

    /** All users in an organization, oldest first. */
    async findAllForTenant(tenantId: string): Promise<UserDocument[]> {
        return this.model.find({ tenantId }).sort({ createdAt: 1 }).exec();
    }

    async findOneForTenant(tenantId: string, id: string): Promise<UserDocument | null> {
        return this.model.findOne({ _id: id, tenantId }).exec();
    }

    async setStatus(tenantId: string, id: string, status: 'active' | 'disabled'): Promise<void> {
        await this.model.updateOne({ _id: id, tenantId }, { $set: { status } }).exec();
    }
}
