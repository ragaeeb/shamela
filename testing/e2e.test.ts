import { Client, createClient } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { downloadBook, downloadMasterDatabase, getBook } from '../src/api';
import { createTempDir } from '../src/utils/io';

describe('e2e', () => {
    describe('downloadMasterDatabase', () => {
        it('should get the latest master metadata and then download it and populate our master database', async () => {
            const outputDir = await createTempDir();
            const dbPath = path.join(outputDir, `master.db`);

            const result = await downloadMasterDatabase({ outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const client: Client = createClient({
                url: `file:${dbPath}`,
            });

            try {
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
        it('should get the books major version url then download it', async () => {
            const outputDir = await createTempDir('shamela_e2e_downloadBook');
            const dbPath = path.join(outputDir, `book.db`);

            const result = await downloadBook(26592, { outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const client: Client = createClient({
                url: `file:${dbPath}`,
            });

            try {
                const {
                    rows: [{ pages, titles }],
                } = await client.execute(
                    'SELECT (SELECT COUNT(*) FROM page) AS pages, (SELECT COUNT(*) FROM title) AS titles',
                );

                expect((pages as number) > 90).toBe(true);
                expect((titles as number) > 0).toBe(true);
            } finally {
                client.close();
                await fs.rm(outputDir, { recursive: true });
            }
        });

        it('should get the books major version url then download it as json', async () => {
            const outputDir = await createTempDir('shamela_e2e_downloadBook');
            const dbPath = path.join(outputDir, `book.json`);

            const result = await downloadBook(26592, { outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            try {
                const { pages, titles } = JSON.parse(await fs.readFile(result, 'utf8'));

                expect(pages.length > 90).toBe(true);
                expect(titles.length > 0).toBe(true);
            } finally {
                await fs.rm(outputDir, { recursive: true });
            }
        });

        it('should get the books major version url then download it as a typed object', async () => {
            const { pages, titles = [] } = await getBook(26592);

            expect(pages.length > 90).toBe(true);
            expect(titles.length > 0).toBe(true);
        });
    });
});
