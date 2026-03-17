import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * FileStreamer — chunks large CSV/JSONL files into batches using Node.js streams.
 *
 * Supports:
 * - CSV with header row (comma-delimited)
 * - JSONL (newline-delimited JSON, one object per line)
 *
 * Uses readline to avoid loading the entire file into memory.
 */
export class FileStreamer {
    /**
     * Streams a CSV file row by row, yielding batches of records.
     * First row is treated as headers.
     *
     * @param filePath  Absolute path to the CSV file
     * @param batchSize Number of records per batch (defaults to 100)
     */
    async *streamCsv(
        filePath: string,
        batchSize = 100,
    ): AsyncIterableIterator<Record<string, string>[]> {
        const rl = createInterface({ input: createReadStream(filePath) });
        let headers: string[] = [];
        let batch: Record<string, string>[] = [];

        for await (const line of rl) {
            const trimmed = line.trim();
            if (!trimmed) continue; // skip blank lines

            if (!headers.length) {
                headers = parseCsvLine(trimmed);
                continue;
            }

            const values = parseCsvLine(trimmed);
            const record = Object.fromEntries(
                headers.map((h, i) => [h.trim(), values[i]?.trim() ?? '']),
            );
            batch.push(record);

            if (batch.length >= batchSize) {
                yield batch;
                batch = [];
            }
        }

        if (batch.length > 0) yield batch;
    }

    /**
     * Streams a JSONL (newline-delimited JSON) file line by line,
     * yielding batches of parsed objects.
     *
     * Each line must be a valid JSON object. Invalid lines are skipped
     * with a console.error (so one bad line doesn't break the whole stream).
     *
     * @param filePath  Absolute path to the JSONL file
     * @param batchSize Number of records per batch (defaults to 100)
     */
    async *streamJsonl<T = Record<string, unknown>>(
        filePath: string,
        batchSize = 100,
    ): AsyncIterableIterator<T[]> {
        const rl = createInterface({ input: createReadStream(filePath) });
        let batch: T[] = [];
        let lineNumber = 0;

        for await (const line of rl) {
            lineNumber++;
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue; // skip blank/comment lines

            try {
                const parsed = JSON.parse(trimmed) as T;
                batch.push(parsed);

                if (batch.length >= batchSize) {
                    yield batch;
                    batch = [];
                }
            } catch {
                console.error(`[FileStreamer] skipping invalid JSON on line ${lineNumber} of ${filePath}`);
            }
        }

        if (batch.length > 0) yield batch;
    }
}

// ─── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Parses a single CSV line respecting double-quoted fields.
 * e.g. 'foo,"bar,baz",qux' → ['foo', 'bar,baz', 'qux']
 */
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped double-quote inside a quoted field
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}
