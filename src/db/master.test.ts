import { Database } from 'bun:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createTempDir } from '../utils/io';
import { setLogger } from '../utils/logger';
import { copyForeignMasterTableData, createTables, getData } from './master';
import { attachDB, insertUnsafely } from './queryBuilder';

const runStatements = (db: Database, statements: string[]) => {
    db.transaction(() => statements.forEach((sql) => db.run(sql)))();
};

describe('master', () => {
    let client: Database;
    let otherClient: Database;
    let dbPath: string;
    let authorPath: string;
    let bookPath: string;
    let categoryPath: string;
    let dbFolder: string;

    beforeAll(async () => {
        dbFolder = await createTempDir('shamela_master_test');
        dbPath = path.join(dbFolder, 'master.db');
        bookPath = path.join(dbFolder, 'book.sqlite');
        categoryPath = path.join(dbFolder, 'category.sqlite');
        authorPath = path.join(dbFolder, 'author.sqlite');
        setLogger(console);
    });

    afterAll(async () => {
        setLogger();
        await fs.rm(dbFolder, { recursive: true });
    });

    beforeEach(() => {
        client = new Database(dbPath);
        otherClient = new Database(bookPath);

        otherClient.run(attachDB(categoryPath, 'categories'));
        otherClient.run(attachDB(authorPath, 'authors'));

        runStatements(otherClient, [
            `CREATE TABLE authors.author (id INTEGER, is_deleted TEXT, name TEXT,biography TEXT, death_text TEXT, death_number TEXT)`,
            `CREATE TABLE main.book (id INTEGER, name TEXT, is_deleted TEXT, category TEXT, type TEXT, date TEXT, author TEXT, printed TEXT, minor_release TEXT, major_release TEXT, bibliography TEXT, hint TEXT, pdf_links TEXT, metadata TEXT)`,
            `CREATE TABLE categories.category (id INTEGER, is_deleted TEXT, "order" TEXT, name TEXT)`,
        ]);

        createTables(client);
    });

    afterEach(async () => {
        client.close();
        otherClient.close();

        await Promise.all([
            fs.rm(authorPath, { recursive: true }),
            fs.rm(bookPath, { recursive: true }),
            fs.rm(categoryPath, { recursive: true }),
            fs.rm(dbPath, { recursive: true }),
        ]);
    });

    describe('copyForeignMasterTableData', () => {
        it('should build the database from the original source tables', () => {
            runStatements(otherClient, [
                insertUnsafely('authors.author', {
                    biography: 'Bio',
                    death_number: '99',
                    death_text: '99',
                    id: 1,
                    name: 'Ahmad',
                }),
                insertUnsafely('main.book', {
                    author: '513',
                    bibliography: 'biblio',
                    category: '1',
                    date: '1225',
                    hint: 'h',
                    id: 1,
                    major_release: '5',
                    metadata: '{"date":"08121431"}',
                    minor_release: '0',
                    name: 'B',
                    pdf_links: `{"alias": 22, "cover": 1, "cover_alias": 20, "root": "https://archive.org/download/tazkerat_samee/", "files": ["16966p.pdf", "16966.pdf|0"], "size": 7328419}`,
                    printed: '1',
                    type: '1',
                }),
                insertUnsafely('main.book', {
                    author: '50',
                    id: 2,
                    metadata: '{"date":"08121431"}',
                    name: 'B',
                }),
                insertUnsafely('categories.category', { '`order`': '1', id: 1, name: 'Fiqh' }),
            ]);

            copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const { authors, books, categories } = getData(client);

            expect(authors).toEqual([
                {
                    biography: 'Bio',
                    death_number: '99',
                    death_text: '99',
                    id: 1,
                    is_deleted: '0',
                    name: 'Ahmad',
                },
            ]);

            expect(books).toEqual([
                {
                    author: '513',
                    bibliography: 'biblio',
                    category: '1',
                    date: '1225',
                    hint: 'h',
                    id: 1,
                    is_deleted: '0',
                    major_release: '5',
                    metadata: '{"date":"08121431"}',
                    minor_release: '0',
                    name: 'B',
                    pdf_links:
                        '{"alias": 22, "cover": 1, "cover_alias": 20, "root": "https://archive.org/download/tazkerat_samee/", "files": ["16966p.pdf", "16966.pdf|0"], "size": 7328419}',
                    printed: '1',
                    type: '1',
                },
                {
                    author: '50',
                    bibliography: null,
                    category: null,
                    date: null,
                    hint: null,
                    id: 2,
                    is_deleted: '0',
                    major_release: null,
                    metadata: '{"date":"08121431"}',
                    minor_release: null,
                    name: 'B',
                    pdf_links: null,
                    printed: null,
                    type: null,
                },
            ]);

            expect(categories).toEqual([
                { id: 1, is_deleted: '0', name: 'Fiqh', order: '1' },
            ]);
        });

        it('should include rows marked as deleted', () => {
            runStatements(otherClient, [
                insertUnsafely('authors.author', { id: 1 }, true),
                insertUnsafely('main.book', { id: 1 }, true),
                insertUnsafely('categories.category', { id: 1 }, true),
            ]);

            copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const { authors, books, categories } = getData(client);

            expect(authors).toEqual([{ biography: null, death_number: null, death_text: null, id: 1, is_deleted: '1', name: null }]);
            expect(books).toEqual([
                {
                    author: null,
                    bibliography: null,
                    category: null,
                    date: null,
                    hint: null,
                    id: 1,
                    is_deleted: '1',
                    major_release: null,
                    metadata: null,
                    minor_release: null,
                    name: null,
                    pdf_links: null,
                    printed: null,
                    type: null,
                },
            ]);
            expect(categories).toEqual([
                { id: 1, is_deleted: '1', name: null, order: null },
            ]);
        });

        it('should expose pluralised compatibility views', () => {
            runStatements(otherClient, [
                insertUnsafely('authors.author', { id: 1 }, true),
                insertUnsafely('main.book', { id: 1 }, true),
                insertUnsafely('categories.category', { id: 1 }, true),
            ]);

            copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const row = client
                .query(
                    'SELECT (SELECT COUNT(*) FROM authors) AS authors, (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM categories) AS categories',
                )
                .get() as { authors: number; books: number; categories: number };

            expect(row).toEqual({ authors: 1, books: 1, categories: 1 });
        });
    });
});
