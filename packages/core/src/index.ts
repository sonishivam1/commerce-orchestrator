// Re-export interfaces (LoadResult is defined in engine/etl.engine.ts to avoid circular re-export)
export type { SourceConnector } from './interfaces/source.interface';
export type { TargetConnector } from './interfaces/target.interface';

// Re-export engine (EtlEngine, EtlContext, EtlEngineOptions, LoadResult)
export * from './engine/etl.engine';
