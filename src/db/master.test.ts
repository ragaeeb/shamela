import { createClient, Client } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';

import { createTempDir } from '../utils/io';
import { copyForeignMasterTableData, createMasterTables } from './master';
import { Tables } from './types';

describe('master', () => {
    let client: Client;
    let dbPath: string;

    beforeAll(async () => {
        dbPath = path.join(await createTempDir(), 'master.db');
    });

    afterAll(async () => {
        await fs.rm(path.parse(dbPath).dir, { recursive: true });
    });

    beforeEach(async () => {
        client = createClient({
            url: `file:${dbPath}`,
        });
    });

    afterEach(async () => {
        client.close();
        await fs.rm(dbPath, { recursive: true });
    });

    describe('createMasterTables', () => {
        it.only('should create the tables', async () => {
            await createMasterTables(client);

            const results = await client.execute(`SELECT * FROM sqlite_master`);

            expect(results.rows).toHaveLength(Object.keys(Tables).length);
        });
    });

    describe('copyForeignMasterTableData', () => {
        it('should create and populate the tables', async () => {
            await createMasterTables(client);
            await copyForeignMasterTableData(client, [
                'testing/dbs/author.sqlite',
                'testing/dbs/book.sqlite',
                'testing/dbs/category.sqlite',
            ]);
        });
    });
});
