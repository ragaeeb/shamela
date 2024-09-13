import { createClient, Client } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, it, beforeEach, afterEach, expect, beforeAll, afterAll } from 'vitest';

import { createTempDir } from '../utils/io';
import { applyPatches, createTables } from './book';
import { insertUnsafely } from './queryBuilder';
import { Tables } from './types';

describe('book', () => {
    let client: Client;
    let aslClient: Client;
    let patchClient: Client;
    let dbPath: string;
    let aslPath: string;
    let patchPath: string;
    let dbFolder: string;

    const createAslTables = async (
        client: Client,
        createPages: boolean = true,
        createTitles: boolean = true,
    ): Promise<void> => {
        const statements: string[] = [];

        if (createPages) {
            statements.push(
                `CREATE TABLE page (id INTEGER PRIMARY KEY, content TEXT, part TEXT, page TEXT, number TEXT, services TEXT, is_deleted TEXT)`,
            );
        }

        if (createTitles) {
            statements.push(
                `CREATE TABLE title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER, is_deleted TEXT)`,
            );
        }

        return client.executeMultiple(statements.join(';'));
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

        aslClient = createClient({
            url: `file:${aslPath}`,
        });

        patchClient = createClient({
            url: `file:${patchPath}`,
        });

        await Promise.all([createAslTables(aslClient), createTables(client)]);
    });

    afterEach(async () => {
        client.close();
        aslClient.close();
        patchClient.close();

        await Promise.all([
            fs.rm(aslPath, { recursive: true }),
            fs.rm(patchPath, { recursive: true }),
            fs.rm(dbPath, { recursive: true }),
        ]);
    });

    describe('applyPatches', () => {
        it('should only copy the relevant pages and titles if there is no patch', async () => {
            await aslClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { id: 1, content: `P1 #2 1/1`, page: 1, number: 2 }),
                    insertUnsafely(Tables.Page, { id: 2, content: `P2 #3 1/2`, part: 1, page: 2, number: 3 }),
                    insertUnsafely(Tables.Page, { id: 3, content: `P3 #4 2/3`, part: 2, page: 3, number: 4 }),
                    insertUnsafely(Tables.Title, { content: `T1`, id: 1, page: 1 }),
                ].join(';'),
            );

            await applyPatches(client, aslPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([
                { id: 1, content: 'P1 #2 1/1', part: null, page: 1, number: 2 },
                { id: 2, content: 'P2 #3 1/2', part: 1, page: 2, number: 3 },
                { id: 3, content: 'P3 #4 2/3', part: 2, page: 3, number: 4 },
            ]);

            expect(titles).toEqual([{ id: 1, content: 'T1', page: 1, parent: null }]);
        });

        it('should not include pages and titles that were deleted', async () => {
            await createAslTables(patchClient);

            await aslClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1 }), insertUnsafely(Tables.Title, { id: 2 })].join(';'),
            );

            await patchClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { id: 1, is_deleted: '1' }),
                    insertUnsafely(Tables.Title, { id: 2, is_deleted: '1' }),
                ].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([]);
            expect(titles).toEqual([]);
        });

        it('should patch the page and title fields', async () => {
            await createAslTables(patchClient);

            await aslClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { id: 1 }),
                    insertUnsafely(Tables.Page, { id: 2, part: '1', number: '4', content: '2X' }),
                    insertUnsafely(Tables.Page, { id: 3 }),
                    insertUnsafely(Tables.Title, { id: 2 }),
                ].join(';'),
            );

            await patchClient.executeMultiple(
                [
                    insertUnsafely(Tables.Page, { id: 1, part: '1', content: 'F', page: '#', is_deleted: '0' }),
                    insertUnsafely(Tables.Page, { id: 2, part: '2', content: '3X', number: '#', is_deleted: '0' }),
                    insertUnsafely(Tables.Page, { id: 3, part: '#', content: '#', number: '#', is_deleted: '0' }),
                    insertUnsafely(Tables.Title, { id: 2, content: 'T', is_deleted: '0' }),
                ].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([
                { id: 1, content: 'F', part: 1, page: null, number: null },
                { id: 2, content: '3X', part: 2, page: null, number: 4 },
                { id: 3, content: null, part: null, page: null, number: null },
            ]);
            expect(titles).toEqual([{ id: 2, content: 'T', page: null, parent: null }]);
        });

        it('should only patch the page and not the title', async () => {
            await createAslTables(patchClient, true, false);

            await aslClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1 }), insertUnsafely(Tables.Title, { id: 2 })].join(';'),
            );

            await patchClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1, part: '1', content: 'F', page: '#', is_deleted: '0' })].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([{ id: 1, content: 'F', part: 1, page: null, number: null }]);
            expect(titles).toEqual([{ id: 2, content: null, page: null, parent: null }]);
        });

        it('should only patch the title and not the page', async () => {
            await createAslTables(patchClient, false, true);

            await aslClient.executeMultiple(
                [insertUnsafely(Tables.Page, { id: 1 }), insertUnsafely(Tables.Title, { id: 2 })].join(';'),
            );

            await patchClient.executeMultiple(
                [insertUnsafely(Tables.Title, { id: 2, content: 'T', is_deleted: '0' })].join(';'),
            );

            await applyPatches(client, aslPath, patchPath);

            const [{ rows: pages }, { rows: titles }] = await Promise.all([
                client.execute(`SELECT * FROM page`),
                client.execute(`SELECT * FROM title`),
            ]);

            expect(pages).toEqual([{ id: 1, content: null, part: null, page: null, number: null }]);
            expect(titles).toEqual([{ id: 2, content: 'T', page: null, parent: null }]);
        });
    });
});
