import { Module } from '@nestjs/common';
import { ScrapeProcessorModule } from './processors/scrape/scrape-processor.module';

@Module({
    imports: [ScrapeProcessorModule],
})
export class ScrapeWorkerModule { }
