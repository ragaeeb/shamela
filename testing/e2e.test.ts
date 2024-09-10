import { createClient } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { copyForeignMasterTableData, createMasterTables } from '../src/db/master';
import { downloadMasterVersion } from '../src/utils/api';
import { createTempDir } from '../src/utils/io';

describe('e2e', () => {
    describe('downloadMasterVersion', () => {
        it('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const outputDir = await createTempDir();
            const dbPath = path.join(outputDir, `master.db`);

            const client = createClient({
                url: `file:${dbPath}`,
            });

            try {
                const result = await downloadMasterVersion({ outputDirectory: { path: outputDir } });
                expect(result).toHaveLength(3);

                await createMasterTables(client);
                await copyForeignMasterTableData(client, result);

                const {
                    rows: [{ authors, books, categories }],
                } = await client.execute(
                    'SELECT (SELECT COUNT(*) FROM authors) AS authors, (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM categories) AS categories',
                );

                expect((authors as number) > 3000).toBe(true);
                expect((books as number) > 8000).toBe(true);
                expect((categories as number) > 30).toBe(true);
            } finally {
                client.close();
                await fs.rm(outputDir, { recursive: true });
            }
        });
    });
});
