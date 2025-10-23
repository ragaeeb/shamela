import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createDatabase, type SqliteDatabase } from './sqlite';
import { applyPatches, copyTableData, createTables, getData } from './book';
import { Tables } from './types';

const insertRow = (db: SqliteDatabase, table: Tables, values: Record<string, any>) => {
    const columns = Object.keys(values);
    const placeholders = columns.map(() => '?').join(',');
    const statement = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);
    try {
        statement.run(...columns.map((column) => values[column]));
    } finally {
        statement.finalize();
    }
};

describe('book database helpers', () => {
    let client: SqliteDatabase;
    let source: SqliteDatabase;
    let patch: SqliteDatabase;

    beforeEach(async () => {
        client = await createDatabase();
        source = await createDatabase();
        patch = await createDatabase();

        createTables(client);
        createTables(source);
        createTables(patch);
    });

    afterEach(() => {
        client.close();
        source.close();
        patch.close();
    });

    it('copyTableData copies pages and titles from source', () => {
        insertRow(source, Tables.Page, {
            content: 'P1',
            id: 1,
            is_deleted: '0',
            number: '1',
            page: '1',
            part: '1',
            services: null,
        });
        insertRow(source, Tables.Title, { content: 'T1', id: 1, is_deleted: '0', page: 1, parent: null });

        copyTableData(client, source);

        const { pages, titles } = getData(client);
        expect(pages).toHaveLength(1);
        expect(titles).toHaveLength(1);
    });

    it('applyPatches merges updates and filters deletions', () => {
        insertRow(source, Tables.Page, {
            content: 'Base',
            id: 1,
            is_deleted: '0',
            number: '1',
            page: '1',
            part: null,
            services: null,
        });
        insertRow(source, Tables.Title, { content: 'Base title', id: 1, is_deleted: '0', page: 1, parent: null });

        insertRow(patch, Tables.Page, {
            content: 'Patched',
            id: 1,
            is_deleted: '0',
            number: '1',
            page: '#',
            part: null,
            services: null,
        });
        insertRow(patch, Tables.Title, { content: 'Patched title', id: 1, is_deleted: '0', page: 2, parent: null });
        insertRow(patch, Tables.Page, {
            content: 'Deleted',
            id: 2,
            is_deleted: '1',
            number: '1',
            page: '1',
            part: null,
            services: null,
        });

        applyPatches(client, source, patch);

        const { pages, titles } = getData(client);

        expect(pages).toEqual([expect.objectContaining({ content: 'Patched', id: 1, page: '1' })]);
        expect(titles).toEqual([expect.objectContaining({ content: 'Patched title', id: 1, page: 2 })]);
    });
});
