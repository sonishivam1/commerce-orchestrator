import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Credential, CredentialDocument } from '../schemas/credential.schema';

@Injectable()
export class CredentialRepository {
    constructor(@InjectModel(Credential.name) private readonly model: Model<CredentialDocument>) { }

    async create(data: Partial<Credential>): Promise<CredentialDocument> {
        return this.model.create(data);
    }

    async findAllForTenant(tenantId: string): Promise<CredentialDocument[]> {
        // NEVER return encryptedPayload — strip it at repository level
        return this.model.find({ tenantId }, { encryptedPayload: 0, iv: 0, authTag: 0 }).exec();
    }

    async findOneDecrypted(tenantId: string, id: string): Promise<CredentialDocument | null> {
        // Full document returned ONLY for the worker — must decrypt in memory
        return this.model.findOne({ _id: id, tenantId }).exec();
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const result = await this.model.deleteOne({ _id: id, tenantId }).exec();
        return result.deletedCount === 1;
    }
}
