import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@cdo/db';
import { QueueModule } from '@cdo/queue';
import { ScrapeProcessorModule } from './processors/scrape/scrape-processor.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        QueueModule,
        ScrapeProcessorModule,
    ],
})
export class ScrapeWorkerModule {}
