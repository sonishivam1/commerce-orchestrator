import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { LockModule } from '../../services/lock.module';
import { CredentialDecryptorService } from '../../services/credential-decryptor.service';
import { AsyncContextService } from '../../common/context/async-context.service';

@Module({
    imports: [LockModule],
    providers: [EtlProcessor, DataEtlOrchestrator, CredentialDecryptorService, AsyncContextService],
})
export class EtlProcessorModule { }
