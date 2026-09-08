import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import { writeFile } from 'fs/promises';

export type FileExportFormat = 'CSV' | 'JSON';

/**
 * A TargetConnector that accumulates the canonical entities passed to load()
 * and writes them to a single CSV or JSON file when the orchestrator calls
 * writeTo(). Used by EXPORT-mode runs instead of a platform target.
 *
 * Not registered in ConnectorFactory — it is not platform-keyed. The worker
 * orchestrator instantiates it directly for EXPORT-mode runs.
 */
export class FileExportTarget implements TargetConnector<CanonicalEntity> {
    private readonly rows: CanonicalEntity[] = [];

    constructor(private readonly format: FileExportFormat) {}

    async initialize(): Promise<void> {
        // no external connection
    }

    getCapabilities(): string[] {
        return ['export'];
    }

    async load(batch: CanonicalEntity[]): Promise<LoadResult[]> {
        this.rows.push(...batch);
        return batch.map((entity) => ({
            key: entity.key ?? 'unknown',
            success: true,
        }));
    }

    /** Number of entities collected so far. */
    get count(): number {
        return this.rows.length;
    }

    /** Serialise everything collected and write it to `filePath`. Returns the byte size. */
    async writeTo(filePath: string): Promise<number> {
        const body =
            this.format === 'JSON'
                ? JSON.stringify(this.rows, null, 2)
                : toCsv(this.rows as unknown as Array<Record<string, unknown>>);
        const buffer = Buffer.from(body, 'utf8');
        await writeFile(filePath, buffer);
        return buffer.byteLength;
    }
}

/** Flat CSV: union of every row's top-level keys; nested values are JSON-encoded. */
function toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return '';

    const columns = Array.from(
        rows.reduce<Set<string>>((set, row) => {
            Object.keys(row).forEach((k) => set.add(k));
            return set;
        }, new Set()),
    );

    const escape = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const lines = [
        columns.join(','),
        ...rows.map((row) => columns.map((col) => escape(row[col])).join(',')),
    ];
    return lines.join('\n');
}
