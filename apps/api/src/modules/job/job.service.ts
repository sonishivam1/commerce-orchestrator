import { Injectable } from '@nestjs/common';
import { CreateJobInput } from './dto/create-job.input';

@Injectable()
export class JobService {
    findAll() {
        // TODO: Query MongoDB via @cdo/db JobRepository scoped by tenantId
        return [];
    }

    findOne(id: string) {
        // TODO: Find job by ID with tenant isolation
        return null;
    }

    create(input: CreateJobInput) {
        // TODO: Validate, encrypt credentials, enqueue to BullMQ via @cdo/queue
        return input;
    }

    replayDlqItem(jobId: string, dlqItemId: string) {
        // TODO: Pull DLQ item from MongoDB, re-enqueue to worker
        return { jobId, dlqItemId };
    }
}
