import { Client, createClient } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTempDir } from '../utils/io';
import { applyPatches, createTables, getData } from './book';
import { attachDB, insertUnsafely } from './queryBuilder';
import { Tables } from './types';

describe('book', () => {
    let client: Client;
    let otherClient: Client;
    let dbPath: string;
    let aslPath: string;
    let patchPath: string;
    let dbFolder: string;

    const createAslTables = async (
        alias: string = 'main',
        createPages: boolean = true,
        createTitles: boolean = true,
    ): Promise<void> => {
        const statements: string[] = [];

        if (createPages) {
            statements.push(
                `CREATE TABLE ${alias}.page (id INTEGER PRIMARY KEY, content TEXT, part TEXT, page TEXT, number TEXT, services TEXT, is_deleted TEXT)`,
            );
        }

        if (createTitles) {
            statements.push(
                `CREATE TABLE ${alias}.title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER, is_deleted TEXT)`,
            );
        }

        return otherClient.executeMultiple(statements.join(';'));
    };

    beforeAll(async () => {
        dbFolder = await createTempDir();
        dbPath = path.join(dbFolder, 'book.db');
        aslPath = path.join(dbFolder, 'asl.db');
        patchPath = path.join(dbFolder, 'patch.db');
    });

    afterAll(async () => {
        await fs.rm(dbFolder, { recursive: true });
    });

    beforeEach(async () => {
        client = createClient({
            url: `file:${dbPath}`,
        });

        otherClient = createClient({
            url: `file:${aslPath}`,
        });

        await Promise.all([otherClient.execute(attachDB(patchPath, 'patch')), createAslTables(), createTables(client)]);
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

    describe('applyPatches', () => {
        it('should only copy the relevant pages and titles if there is no patch', async () => {
            await otherClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { content: `P1 #2 1/1`, id: 1, number: 2, page: 1 }),
                    insertUnsafely(Tables.Page, { content: `P2 #3 1/2`, id: 2, number: 3, page: 2, part: 1 }),
                    insertUnsafely(Tables.Page, { content: `P3 #4 2/3`, id: 3, number: 4, page: 3, part: 2 }),
                    insertUnsafely(Tables.Title, { content: `T1`, id: 1, page: 1 }),
                ].join(';'),
            );

            await applyPatches(client, aslPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([
                { content: 'P1 #2 1/1', id: 1, number: 2, page: 1, part: null },
                { content: 'P2 #3 1/2', id: 2, number: 3, page: 2, part: 1 },
                { content: 'P3 #4 2/3', id: 3, number: 4, page: 3, part: 2 },
            ]);

            expect(titles).toEqual([{ content: 'T1', id: 1, page: 1, parent: null }]);
        });

        it('should not include pages and titles that were deleted', async () => {
            await createAslTables('patch');

            await otherClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1 }), insertUnsafely(Tables.Title, { id: 2 })].join(';'),
            );

            await otherClient.executeMultiple(
                [insertUnsafely('patch.page', { id: 1 }, true), insertUnsafely('patch.title', { id: 2 }, true)].join(
                    ';',
                ),
            );

            await applyPatches(client, aslPath, patchPath);

            const { pages, titles } = await getData(client);

            expect(pages).toHaveLength(0);
            expect(titles).toHaveLength(0);
        });

        it('should patch the page and title fields', async () => {
            await createAslTables('patch');

            await otherClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { id: 1 }),
                    insertUnsafely(Tables.Page, { content: '2X', id: 2, number: '4', part: '1' }),
                    insertUnsafely(Tables.Page, { content: '', id: 3 }),
                    insertUnsafely(Tables.Title, { id: 2, page: 9 }),
                ].join(';'),
            );

            await otherClient.executeMultiple(
                [
                    insertUnsafely('patch.page', { content: 'F', id: 1, page: '#', part: '1' }),
                    insertUnsafely('patch.page', { content: '3X', id: 2, number: '#', part: '2' }),
                    insertUnsafely('patch.page', { content: '#', id: 3, number: '#', part: '#' }),
                    insertUnsafely('patch.title', { content: 'T', id: 2, page: 20 }),
                ].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const { pages, titles } = await getData(client);

            expect(pages).toEqual([
                { content: 'F', id: 1, part: 1 },
                { content: '3X', id: 2, number: 4, part: 2 },
                { content: '', id: 3 },
            ]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: 20 }]);
        });

        it('should only patch the page and not the title', async () => {
            await createAslTables('patch', true, false);

            await otherClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1 }), insertUnsafely(Tables.Title, { content: 'T', id: 2 })].join(
                    ';',
                ),
            );

            await otherClient.executeMultiple(
                [insertUnsafely('patch.page', { content: 'F', id: 1, page: '#', part: '1' })].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const { pages, titles } = await getData(client);

            expect(pages).toEqual([{ content: 'F', id: 1, part: 1 }]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: null }]);
        });

        it('should only patch the title and not the page', async () => {
            await createAslTables('patch', false, true);

            await otherClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { content: 'C', id: 1 }),
                    insertUnsafely(Tables.Title, { id: 2, page: 1 }),
                ].join(';'),
            );

            await otherClient.executeMultiple([insertUnsafely('patch.title', { content: 'T', id: 2 })].join(';'));

            await applyPatches(client, aslPath, patchPath);

            const { pages, titles } = await getData(client);

            expect(pages).toEqual([{ content: 'C', id: 1 }]);
            expect(titles).toEqual([{ content: 'T', id: 2, page: 1 }]);
        });
    });
});
