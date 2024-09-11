import { createClient } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { copyForeignMasterTableData, createMasterTables } from '../src/db/master';
import { downloadMasterDatabase, getBookMetadata } from '../src/utils/api';
import { createTempDir } from '../src/utils/io';

describe('e2e', () => {
    describe('downloadMasterDatabase', () => {
        it('should get the latest master metadata and then download it and populate our master database', async () => {
            const outputDir = await createTempDir();
            const dbPath = path.join(outputDir, `master.db`);

            const client = createClient({
                url: `file:${dbPath}`,
            });

            try {
                const result = await downloadMasterDatabase({ outputDirectory: { path: outputDir } });
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

    describe('downloadBook', () => {
        it.only('should get the books major version url then download it', async () => {
            const outputDir = await createTempDir();
            const dbPath = path.join(outputDir, `master.db`);

            const client = createClient({
                url: `file:${dbPath}`,
            });

            try {
                const result = await getBookMetadata(767);
                console.log('resu', result);
            } finally {
                client.close();
                await fs.rm(outputDir, { recursive: true });
            }
        });
    });
});
