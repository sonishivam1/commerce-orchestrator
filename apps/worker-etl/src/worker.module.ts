import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { EtlProcessorModule } from './processors/etl/etl-processor.module';

/**
 * ETL Worker — processes the etl-queue.
 * Scrape jobs are handled by apps/worker-scrape, not this worker.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env'],
        }),
        DatabaseModule,
        QueueModule,
        EtlProcessorModule,
    ],
})
export class WorkerModule { }
