import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { MigrationRunOrchestrator } from '../../orchestrator/migration-run.orchestrator';
import { WaveExecutorService } from '../../orchestrator/wave-executor.service';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Module({
    providers: [
        EtlProcessor,
        // Wave-based migration/export run path (MIGRATION_RUN)
        WaveExecutorService,
        MigrationRunOrchestrator,
        // Shared infrastructure
        CredentialDecryptor,
        LockService,
    ],
})
export class EtlProcessorModule {}
