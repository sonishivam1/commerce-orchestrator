import { Module } from '@nestjs/common';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeOrchestrator } from '../../orchestrator/scrape.orchestrator';
import { LockModule } from '../../services/lock.module';
import { CredentialDecryptorService } from '../../services/credential-decryptor.service';
import { AsyncContextService } from '../../common/context/async-context.service';

@Module({
    imports: [LockModule],
    providers: [ScrapeProcessor, ScrapeOrchestrator, CredentialDecryptorService, AsyncContextService],
})
export class ScrapeProcessorModule { }
