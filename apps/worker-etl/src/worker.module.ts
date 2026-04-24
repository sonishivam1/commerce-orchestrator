import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { EtlProcessorModule } from './processors/etl/etl-processor.module';
import { ScrapeProcessorModule } from './processors/scrape/scrape-processor.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env'],
        }),
        DatabaseModule,
        QueueModule,
        EtlProcessorModule, 
        ScrapeProcessorModule
    ],
})
export class WorkerModule { }
