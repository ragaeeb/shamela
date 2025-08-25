import { Client, createClient } from '@libsql/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';

import { downloadBook, downloadMasterDatabase, getBook } from '../src/api';
import { createTempDir } from '../src/utils/io';
import { setLogger } from '../src/utils/logger';

describe('e2e', () => {
    let outputDir;

    beforeAll(() => {
        setLogger(console);
    });

    beforeEach(async () => {
        outputDir = await createTempDir('shamela_e2e');
    });

    afterEach(async () => {
        await fs.rm(outputDir, { recursive: true });
    });

    describe('downloadMasterDatabase', () => {
        it('should get the latest master metadata and then download it and populate our master database', async () => {
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
            }
        }, 20000);

        it('should get the latest master metadata and then download it as a JSON', async () => {
            const dbPath = path.join(outputDir, `master.json`);

            const result = await downloadMasterDatabase({ outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const { authors, books, categories } = JSON.parse(await fs.readFile(result, 'utf8'));

            expect((authors.length as number) > 3000).toBe(true);
            expect((books.length as number) > 8000).toBe(true);
            expect((categories.length as number) > 30).toBe(true);
        }, 20000);
    });

    describe('downloadBook', () => {
        it('should get the books major version url then download it', async () => {
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
            }
        }, 20000);

        it('should get the books major version url then download it as json', async () => {
            const dbPath = path.join(outputDir, `book.json`);

            const result = await downloadBook(26592, { outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const { pages, titles } = JSON.parse(await fs.readFile(result, 'utf8'));

            expect(pages.length > 90).toBe(true);
            expect(titles.length > 0).toBe(true);
        }, 20000);

        it('should get the books major version url then download it as a typed object', async () => {
            const { pages, titles = [] } = await getBook(26592);

            expect(pages.length > 90).toBe(true);
            expect(titles.length > 0).toBe(true);
        }, 20000);

        it('should get the not crash if minor release url is not available', async () => {
            const { pages, titles = [] } = await getBook(23644);

            expect(pages.length > 90).toBe(true);
            expect(titles.length > 0).toBe(true);
        }, 20000);

        it('should get the not crash if is_deleted column is not available', async () => {
            const { pages, titles = [] } = await getBook(1388);

            expect(pages.length > 200).toBe(true);
            expect(titles.length > 110).toBe(true);
        }, 20000);

        it('should get the not crash if is_deleted column did not exist on the asl', async () => {
            const { pages, titles = [] } = await getBook(12994);

            expect(pages.length > 200).toBe(true);
            expect(titles.length > 20).toBe(true);
        }, 20000);

        it('should correct the http protocol', async () => {
            const { pages, titles = [] } = await getBook(6315);

            expect(pages.length > 10).toBe(true);
            expect(titles.length > 5).toBe(true);
        }, 20000);
    });
});
