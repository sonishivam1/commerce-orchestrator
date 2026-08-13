import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DlqRepository } from '@cdo/db';

@Injectable()
export class DlqService {
    constructor(private readonly dlqRepository: DlqRepository) {}

    async findAllForJob(tenantId: string, jobId: string) {
        return this.dlqRepository.findAllForJob(tenantId, jobId);
    }

    async countPending(tenantId: string, jobId: string): Promise<number> {
        return this.dlqRepository.countPendingForJob(tenantId, jobId);
    }

    async delete(tenantId: string, id: string): Promise<boolean> {
        const item = await this.dlqRepository.findOneForTenant(tenantId, id);
        if (!item) throw new NotFoundException(`DLQ item ${id} not found`);
        return this.dlqRepository.delete(tenantId, id);
    }

    async markReplayed(tenantId: string, id: string): Promise<void> {
        const item = await this.dlqRepository.findOneForTenant(tenantId, id);
        if (!item) throw new NotFoundException(`DLQ item ${id} not found`);
        if (item.replayed) throw new BadRequestException(`DLQ item ${id} already replayed`);
        await this.dlqRepository.markReplayed(id);
    }
}
