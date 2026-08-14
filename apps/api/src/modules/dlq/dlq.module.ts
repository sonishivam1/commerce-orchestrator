import { Module } from '@nestjs/common';
import { DlqService } from './dlq.service';
import { DlqResolver } from './dlq.resolver';

@Module({
    providers: [DlqService, DlqResolver],
})
export class DlqModule {}
