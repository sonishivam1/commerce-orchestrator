import { Module } from '@nestjs/common';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Module({
    providers: [ScrapeProcessor, ScrapeOrchestrator, CredentialDecryptor, LockService],
})
export class ScrapeProcessorModule { }
