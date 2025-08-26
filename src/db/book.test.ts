import { Database } from 'bun:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createTempDir } from '../utils/io';
import { setLogger } from '../utils/logger';
import { applyPatches, copyTableData, createTables, getData } from './book';
import { attachDB, insertUnsafely } from './queryBuilder';
import { Tables } from './types';

describe('book', () => {
    let client: Database;
    let otherClient: Database;
    let dbPath: string;
    let aslPath: string;
    let patchPath: string;
    let dbFolder: string;

    const createAslTables = (alias: string = 'main', createPages: boolean = true, createTitles: boolean = true) => {
        if (createPages) {
            otherClient.run(
                `CREATE TABLE ${alias}.page (id INTEGER PRIMARY KEY, content TEXT, part TEXT, page TEXT, number TEXT, services TEXT, is_deleted TEXT)`,
            );
        }

        if (createTitles) {
            otherClient.run(
                `CREATE TABLE ${alias}.title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER, is_deleted TEXT)`,
            );
        }
    };

    beforeAll(async () => {
        dbFolder = await createTempDir('shamela_book_test');
        dbPath = path.join(dbFolder, 'book.db');
        aslPath = path.join(dbFolder, 'asl.db');
        patchPath = path.join(dbFolder, 'patch.db');
        setLogger(console);
    });

    afterAll(async () => {
        await fs.rm(dbFolder, { recursive: true });
    });

    beforeEach(() => {
        client = new Database(dbPath);
        otherClient = new Database(dbPath);

        otherClient.run(attachDB(patchPath, 'patch'));
        createAslTables();
        createTables(client);
    });

    afterEach(async () => {
        client.close();
        otherClient.close();

        await Promise.all([
            fs.rm(aslPath, { recursive: true }),
            fs.rm(patchPath, { recursive: true }),
            fs.rm(dbPath, { recursive: true }),
        ]);
    });

    describe('copyTableData', () => {
        it('should only copy the relevant pages and titles', () => {
            otherClient.transaction((t) => {
                [
                    insertUnsafely(Tables.Page, { content: `P1 #2 1/1`, id: 1, number: 2, page: 1 }),
                    insertUnsafely(Tables.Page, { content: `P2 #3 1/2`, id: 2, number: 3, page: 2, part: 1 }),
                    insertUnsafely(Tables.Page, { content: `P3 #4 2/3`, id: 3, number: 4, page: 3, part: 2 }),
                    insertUnsafely(Tables.Title, { content: `T1`, id: 1, page: 1 }),
                ].forEach((statement) => t.run(statement));
            });

            copyTableData(client, aslPath);

            const pages = client.query(`SELECT * FROM page`).all();
            const titles = client.query(`SELECT * FROM title`).all();

            expect(pages).toEqual([
                { content: 'P1 #2 1/1', id: 1, number: 2, page: 1, part: null },
                { content: 'P2 #3 1/2', id: 2, number: 3, page: 2, part: 1 },
                { content: 'P3 #4 2/3', id: 3, number: 4, page: 3, part: 2 },
            ]);

            expect(titles).toEqual([{ content: 'T1', id: 1, page: 1, parent: null }] as any);
        });
    });

    describe('applyPatches', () => {
        it('should not include pages and titles that were deleted', () => {
            createAslTables('patch');

            otherClient.transaction((t) => {
                [
                    insertUnsafely(Tables.Page, { id: 1 }),
                    insertUnsafely(Tables.Title, { id: 2 }),
                    insertUnsafely('patch.page', { id: 1 }, true),
                    insertUnsafely('patch.title', { id: 2 }, true),
                ].forEach((statement) => t.run(statement));
            });

            applyPatches(client, aslPath, patchPath);

            const { pages, titles } = getData(client);

            expect(pages).toBeEmpty();
            expect(titles).toBeEmpty();
        });

        it('should patch the page and title fields', () => {
            createAslTables('patch');

            otherClient.transaction((t) => {
                [
                    insertUnsafely(Tables.Page, { id: 1 }),
                    insertUnsafely(Tables.Page, { content: '2X', id: 2, number: '4', part: '1' }),
                    insertUnsafely(Tables.Page, { content: '', id: 3 }),
                    insertUnsafely(Tables.Title, { id: 2, page: 9 }),
                    insertUnsafely('patch.page', { content: 'F', id: 1, page: '#', part: '1' }),
                    insertUnsafely('patch.page', { content: '3X', id: 2, number: '#', part: '2' }),
                    insertUnsafely('patch.page', { content: '#', id: 3, number: '#', part: '#' }),
                    insertUnsafely('patch.title', { content: 'T', id: 2, page: 20 }),
                ].forEach((statement) => t.run(statement));
            });

            applyPatches(client, aslPath, patchPath);

            const { pages, titles } = getData(client);

            expect(pages).toEqual([
                { content: 'F', id: 1, part: 1 },
                { content: '3X', id: 2, number: 4, part: 2 },
                { content: '', id: 3 },
            ]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: 20 }]);
        });

        it('should only patch the page and not the title', () => {
            createAslTables('patch', true, false);

            otherClient.transaction((t) => {
                [
                    insertUnsafely(Tables.Page, { id: 1 }),
                    insertUnsafely(Tables.Title, { content: 'T', id: 2 }),
                    insertUnsafely('patch.page', { content: 'F', id: 1, page: '#', part: '1' }),
                ].forEach((statement) => t.run(statement));
            });

            applyPatches(client, aslPath, patchPath);

            const { pages, titles } = getData(client);

            expect(pages).toEqual([{ content: 'F', id: 1, part: 1 }]);
            expect(titles).toMatchObject([{ content: 'T', id: 2, page: null }]);
        });

        it('should only patch the title and not the page', () => {
            createAslTables('patch', false, true);

            otherClient.transaction((t) => {
                [
                    insertUnsafely(Tables.Page, { content: 'C', id: 1 }),
                    insertUnsafely(Tables.Title, { id: 2, page: 1 }),
                    insertUnsafely('patch.title', { content: 'T', id: 2 }),
                ].forEach((statement) => t.run(statement));
            });

            applyPatches(client, aslPath, patchPath);

            const { pages, titles } = getData(client);

            expect(pages).toEqual([{ content: 'C', id: 1 }]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: 1 }]);
        });

        it('should handle case where is_deleted does not exist on the asl', () => {
            otherClient.transaction((t) => {
                [
                    `DROP TABLE main.title`,
                    `DROP TABLE main.page`,
                    `INSERT INTO main.page (id,content) VALUES (1, 'C')`,
                    `INSERT INTO main.title (id,content,page) VALUES (2, 'T',1)`,
                ].forEach((statement) => t.run(statement));
            });

            applyPatches(client, aslPath, patchPath);

            const { pages, titles } = getData(client);

            expect(pages).toEqual([{ content: 'C', id: 1 }]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: 1 }]);
        });
    });
});
