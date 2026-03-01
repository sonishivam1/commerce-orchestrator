export interface SourceConnector<TCanonical> {
    initialize(credentials: Record<string, any>): Promise<void>;
    extract(cursor?: string): AsyncIterableIterator<TCanonical[]>;
}
