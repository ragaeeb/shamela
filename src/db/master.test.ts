import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createDatabase, type SqliteDatabase } from './sqlite';
import { copyForeignMasterTableData, createTables, getData } from './master';
import { Tables } from './types';

type SourceTable = { name: string; data: Uint8Array };

const createSourceTable = async (table: Tables, rows: Record<string, any>[]) => {
    const db = await createDatabase();

    switch (table) {
        case Tables.Authors:
            db.run(
                `CREATE TABLE ${Tables.Authors} (id INTEGER, is_deleted TEXT, name TEXT, biography TEXT, death_text TEXT, death_number TEXT)`,
            );
            break;
        case Tables.Books:
            db.run(
                `CREATE TABLE ${Tables.Books} (id INTEGER, name TEXT, is_deleted TEXT, category TEXT, type TEXT, date TEXT, author TEXT, printed TEXT, minor_release TEXT, major_release TEXT, bibliography TEXT, hint TEXT, pdf_links TEXT, metadata TEXT)`,
            );
            break;
        case Tables.Categories:
            db.run(`CREATE TABLE ${Tables.Categories} (id INTEGER, is_deleted TEXT, "order" TEXT, name TEXT)`);
            break;
        default:
            throw new Error('Unsupported table');
    }

    for (const row of rows) {
        const columns = Object.keys(row);
        const columnNames = columns.map((column) => (column === 'order' ? '"order"' : column));
        const placeholders = columns.map(() => '?').join(',');
        const statement = db.prepare(`INSERT INTO ${table} (${columnNames.join(',')}) VALUES (${placeholders})`);
        try {
            statement.run(...columns.map((column) => row[column]));
        } finally {
            statement.finalize();
        }
    }

    const data = db.export();
    db.close();
    return { data, name: `${table}.sqlite` } satisfies SourceTable;
};

describe('master database helpers', () => {
    let client: SqliteDatabase;

    beforeEach(async () => {
        client = await createDatabase();
        createTables(client);
    });

    afterEach(() => {
        client?.close();
    });

    it('copyForeignMasterTableData populates the master database', async () => {
        const authors = await createSourceTable(Tables.Authors, [
            { biography: 'Bio', death_number: '99', death_text: 'Ninety Nine', id: 1, is_deleted: '0', name: 'Ahmad' },
        ]);
        const books = await createSourceTable(Tables.Books, [
            {
                author: '513',
                bibliography: 'biblio',
                category: '1',
                date: '1225',
                hint: 'hint',
                id: 1,
                is_deleted: '0',
                major_release: '5',
                metadata: '{}',
                minor_release: '0',
                name: 'Book',
                pdf_links: null,
                printed: '1',
                type: '1',
            },
        ]);
        const categories = await createSourceTable(Tables.Categories, [
            { id: 1, is_deleted: '0', name: 'Fiqh', order: '1' },
        ]);

        await copyForeignMasterTableData(client, [books, categories, authors]);

        const data = getData(client, 7);
        expect(data.authors).toHaveLength(1);
        expect(data.books).toHaveLength(1);
        expect(data.categories).toHaveLength(1);
        expect(data.version).toBe(7);
    });

    it('preserves deletion flags from source tables', async () => {
        const authors = await createSourceTable(Tables.Authors, [{ id: 1, is_deleted: '1', name: 'Removed' }]);
        const books = await createSourceTable(Tables.Books, [{ id: 1, is_deleted: '1', name: 'Removed', author: null }]);
        const categories = await createSourceTable(Tables.Categories, [{ id: 1, is_deleted: '1', name: 'Removed', order: null }]);

        await copyForeignMasterTableData(client, [books, categories, authors]);

        const data = getData(client, 3);
        expect(data.authors[0].is_deleted).toBe('1');
        expect(data.books[0].is_deleted).toBe('1');
        expect(data.categories[0].is_deleted).toBe('1');
        expect(data.version).toBe(3);
    });
});
