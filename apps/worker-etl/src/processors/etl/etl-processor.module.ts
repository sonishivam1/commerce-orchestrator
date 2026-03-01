import { Module } from '@nestjs/common';
import { EtlProcessor } from './etl.processor';

@Module({
    providers: [EtlProcessor],
})
export class EtlProcessorModule { }
