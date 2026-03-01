import { Injectable } from '@nestjs/common';
import { CreateTenantInput } from './dto/create-tenant.input';

@Injectable()
export class TenantService {
    getProfile() {
        // TODO: Extract tenantId from JWT context, fetch from MongoDB TenantRepository
        return null;
    }

    create(input: CreateTenantInput) {
        // TODO: Hash password, generate tenantId, persist to MongoDB
        return input;
    }
}
