import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';
import { MigrationRunOrchestrator } from '../../orchestrator/migration-run.orchestrator';
import { WaveExecutorService } from '../../orchestrator/wave-executor.service';
import { CredentialDecryptor } from '../../services/credential.decryptor';
import { LockService } from '../../services/lock.service';

@Module({
    providers: [
        EtlProcessor,
        // Legacy ETL path (CROSS_PLATFORM_MIGRATION, PLATFORM_CLONE, EXPORT, SCRAPE_IMPORT)
        DataEtlOrchestrator,
        // Wave-based migration path (MIGRATION_RUN)
        WaveExecutorService,
        MigrationRunOrchestrator,
        // Shared infrastructure
        CredentialDecryptor,
        LockService,
    ],
})
export class EtlProcessorModule {}
