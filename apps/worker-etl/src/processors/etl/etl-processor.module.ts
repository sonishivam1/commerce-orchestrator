import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Module({
    providers: [EtlProcessor, DataEtlOrchestrator, CredentialDecryptor, LockService],
})
export class EtlProcessorModule { }
