import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';
import { DataEtlOrchestrator } from '../../orchestrator/data-etl.orchestrator';

@Module({
    providers: [EtlProcessor, DataEtlOrchestrator],
})
export class EtlProcessorModule { }
