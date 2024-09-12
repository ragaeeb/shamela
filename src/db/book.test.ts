import { createClient, Client } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, it, beforeEach, afterEach, expect, beforeAll, afterAll } from 'vitest';

import { createTempDir } from '../utils/io';
import { applyPatches, createTables } from './book';

describe('book', () => {
    let client: Client;
    let aslClient: Client;
    let patchClient: Client;
    let dbPath: string;
    let aslPath: string;
    let patchPath: string;
    let dbFolder: string;

    beforeAll(async () => {
        dbFolder = await createTempDir();
    });

    afterAll(async () => {
        await fs.rm(dbFolder, { recursive: true });
    });

    beforeEach(async () => {
        dbPath = path.join(dbFolder, 'book.db');
        aslPath = path.join(dbFolder, 'asl.db');
        patchPath = path.join(dbFolder, 'patch.db');

        client = createClient({
            url: `file:${dbPath}`,
        });

        aslClient = createClient({
            url: `file:${aslPath}`,
        });

        patchClient = createClient({
            url: `file:${patchPath}`,
        });
    });

    afterEach(async () => {
        client.close();
        aslClient.close();
        patchClient.close();
    });

    describe('applyPatches', () => {
        it('should just copy the relevant pages if there is no patch', async () => {
            await createTables(client);

            const aslPath = path.join('testing', 'asl.db');

            const aslDB = createClient({
                url: `file:${aslPath}`,
            });

            try {
                await aslDB.executeMultiple(
                    [
                        `CREATE TABLE page (id INTEGER PRIMARY KEY, content TEXT, part TEXT, page TEXT, number TEXT)`,
                        `CREATE TABLE title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER)`,
                        `INSERT INTO page VALUES (1,'P1 #2 1/1', NULL, 1, 2), (2,'P2 #3 1/2', 1, 2, 3), (3,'P3 #4 2/3', 2, 3, 4)`,
                        `INSERT INTO title VALUES (1,'T1', 1, NULL)`,
                    ].join(';'),
                );
            } finally {
                aslDB.close();
            }

            try {
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
            } finally {
                fs.rm(aslPath, { recursive: true });
            }
        });
    });
});
