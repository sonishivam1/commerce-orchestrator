import { Module } from '@nestjs/common';
import { ScrapeProcessor } from './scrape.processor';

@Module({
    providers: [ScrapeProcessor],
})
export class ScrapeProcessorModule { }
