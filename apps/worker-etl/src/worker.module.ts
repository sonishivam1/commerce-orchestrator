import { Module } from '@nestjs/common';
import { EtlProcessorModule } from './processors/etl/etl-processor.module';
import { ScrapeProcessorModule } from './processors/scrape/scrape-processor.module';

@Module({
    imports: [EtlProcessorModule, ScrapeProcessorModule],
})
export class WorkerModule { }
