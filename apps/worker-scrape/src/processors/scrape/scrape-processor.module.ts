import { Module } from '@nestjs/common';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';

@Module({
    providers: [ScrapeProcessor, ScrapeOrchestrator],
})
export class ScrapeProcessorModule { }
