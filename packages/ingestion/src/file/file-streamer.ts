import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * FileStreamer — chunks large CSV/JSONL files into batches using Node.js streams.
 */
export class FileStreamer {
    async *streamCsv(filePath: string, batchSize = 100): AsyncIterableIterator<Record<string, string>[]> {
        const rl = createInterface({ input: createReadStream(filePath) });
        let headers: string[] = [];
        let batch: Record<string, string>[] = [];

        for await (const line of rl) {
            if (!headers.length) {
                headers = line.split(',');
                continue;
            }
            const values = line.split(',');
            batch.push(Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() ?? ''])));
            if (batch.length >= batchSize) {
                yield batch;
                batch = [];
            }
        }
        if (batch.length) yield batch;
    }
}
