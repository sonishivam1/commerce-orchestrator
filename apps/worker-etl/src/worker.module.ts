import { Module } from '@nestjs/common';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { EtlProcessorModule } from './processors/etl/etl-processor.module';
import { ScrapeProcessorModule } from './processors/scrape/scrape-processor.module';

@Module({
    imports: [
        DatabaseModule,
        QueueModule,
        EtlProcessorModule, 
        ScrapeProcessorModule
    ],
})
export class WorkerModule { }
