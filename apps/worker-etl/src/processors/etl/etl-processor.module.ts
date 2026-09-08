import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { MigrationRunOrchestrator } from '../../orchestrator/migration-run.orchestrator';
import { WaveExecutorService } from '../../orchestrator/wave-executor.service';
import { CredentialDecryptor } from '../../services/credential.decryptor';

@Module({
    providers: [
        EtlProcessor,
        WaveExecutorService,
        MigrationRunOrchestrator,
        CredentialDecryptor,
    ],
})
export class EtlProcessorModule {}
