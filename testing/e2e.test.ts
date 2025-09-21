import { Database } from 'bun:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { downloadBook, downloadMasterDatabase, getBook, getCoverUrl } from '../src/api';
import { createTempDir } from '../src/utils/io';
import { setLogger } from '../src/utils/logger';

describe('e2e', () => {
    let outputDir: string;

    beforeAll(() => {
        setLogger(console);
    });

    afterAll(() => {
        setLogger();
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

            const client = new Database(dbPath);

            try {
                const row = client
                    .query(
                        'SELECT (SELECT COUNT(*) FROM authors) AS authors, (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM categories) AS categories',
                    )
                    .get();

                const { authors, books, categories } = row as { authors: number; books: number; categories: number };

                expect(authors > 3000).toBeTrue();
                expect(books > 8000).toBeTrue();
                expect(categories > 30).toBeTrue();
            } finally {
                client.close();
            }
        }, 30000);

        it('should get the latest master metadata and then download it as a JSON', async () => {
            const dbPath = path.join(outputDir, `master.json`);

            const result = await downloadMasterDatabase({ outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const { authors, books, categories } = JSON.parse(await fs.readFile(result, 'utf8'));

            expect((authors.length as number) > 3000).toBeTrue();
            expect((books.length as number) > 8000).toBeTrue();
            expect((categories.length as number) > 30).toBeTrue();
        }, 30000);
    });

    describe('downloadBook', () => {
        it('should get the books major version url then download it', async () => {
            const dbPath = path.join(outputDir, `book.db`);

            const result = await downloadBook(26592, { outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const client = new Database(dbPath);

            try {
                const row = client
                    .query('SELECT (SELECT COUNT(*) FROM page) AS pages, (SELECT COUNT(*) FROM title) AS titles')
                    .get();

                const { pages, titles } = row as { pages: number; titles: number };

                expect(pages > 90).toBeTrue();
                expect(titles > 0).toBeTrue();
            } finally {
                client.close();
            }
        }, 30000);

        it('should get the books major version url then download it as json', async () => {
            const dbPath = path.join(outputDir, `book.json`);

            const result = await downloadBook(26592, { outputFile: { path: dbPath } });
            expect(result).toEqual(dbPath);

            const { pages, titles } = JSON.parse(await fs.readFile(result, 'utf8'));

            expect(pages.length > 90).toBeTrue();
            expect(titles.length > 0).toBeTrue();
        }, 30000);
    });

    describe('getBook', () => {
        it('should get the books major version url then download it as a typed object', async () => {
            const { pages, titles = [] } = await getBook(26592);

            expect(pages.length > 90).toBeTrue();
            expect(titles.length > 0).toBeTrue();

            expect(pages[0].page).toBe(43);
            expect(pages[0].number).toBe('1');
            expect(pages[0].id).toBe(1);

            expect(titles[0].id).toBe(1);
            expect(titles[0].page).toBe(1);
        }, 30000);

        it('should get the not crash if minor release url is not available', async () => {
            const { pages, titles = [] } = await getBook(23644);

            expect(pages.length > 90).toBeTrue();
            expect(titles.length > 0).toBeTrue();

            expect(pages[0].part).toBe('مقدمة');
            expect(titles[1].parent).toBe(1);
        }, 30000);

        it('should get the not crash if is_deleted column is not available', async () => {
            const { pages, titles = [] } = await getBook(1388);

            expect(pages.length > 200).toBeTrue();
            expect(titles.length > 110).toBeTrue();
        }, 30000);

        it('should get the not crash if is_deleted column did not exist on the asl', async () => {
            const { pages, titles = [] } = await getBook(12994);

            expect(pages.length > 200).toBeTrue();
            expect(titles.length > 20).toBeTrue();
        }, 30000);

        it('should correct the http protocol', async () => {
            const { pages, titles = [] } = await getBook(6315);

            expect(pages.length > 10).toBeTrue();
            expect(titles.length > 5).toBeTrue();
        }, 30000);
    });

    describe('getCoverUrl', () => {
        it('should get the cover url', () => {
            const pattern = /https:\/\/[a-z.]+\/covers\/33.jpg/g;
            expect(getCoverUrl(33)).toMatch(pattern);
        });
    });
});
