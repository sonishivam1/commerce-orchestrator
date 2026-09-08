import { FileExportTarget } from '../file-export.target';
import { readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const rows = [
    { key: 'p-1', name: { en: 'Widget' }, isPublished: true },
    { key: 'p-2', name: { en: 'Gadget' }, isPublished: false },
] as any[];

describe('FileExportTarget', () => {
    let dir: string;

    beforeAll(async () => {
        dir = await mkdtemp(join(tmpdir(), 'cdo-export-'));
    });
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('load() returns a success result per entity and accumulates rows', async () => {
        const target = new FileExportTarget('JSON');
        const results = await target.load(rows);
        expect(results).toEqual([
            { key: 'p-1', success: true },
            { key: 'p-2', success: true },
        ]);
        expect(target.count).toBe(2);
    });

    it('writes a valid JSON array', async () => {
        const target = new FileExportTarget('JSON');
        await target.load(rows);
        const path = join(dir, 'out.json');
        const size = await target.writeTo(path);
        expect(size).toBeGreaterThan(0);
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        expect(parsed).toHaveLength(2);
        expect(parsed[0].key).toBe('p-1');
    });

    it('writes CSV with a header row and JSON-encoded nested cells', async () => {
        const target = new FileExportTarget('CSV');
        await target.load(rows);
        const path = join(dir, 'out.csv');
        await target.writeTo(path);
        const csv = await readFile(path, 'utf8');
        const [header, first] = csv.split('\n');
        expect(header.split(',')).toEqual(expect.arrayContaining(['key', 'name', 'isPublished']));
        expect(first).toContain('p-1');
        expect(first).toContain('"{""en"":""Widget""}"');
    });
});
