import { Client, createClient } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UNKNOWN_DATE_PLACEHOLDER } from '../utils/constants';
import { createTempDir } from '../utils/io';
import { copyForeignMasterTableData, createTables } from './master';
import { attachDB, insertUnsafely } from './queryBuilder';
import { Tables } from './types';

describe('master', () => {
    let client: Client;
    let otherClient: Client;
    let dbPath: string;
    let authorPath: string;
    let bookPath: string;
    let categoryPath: string;
    let dbFolder: string;

    beforeAll(async () => {
        dbFolder = await createTempDir();
        dbPath = path.join(dbFolder, 'master.db');
        bookPath = path.join(dbFolder, 'book.sqlite');
        categoryPath = path.join(dbFolder, 'category.sqlite');
        authorPath = path.join(dbFolder, 'author.sqlite');
    });

    afterAll(async () => {
        await fs.rm(dbFolder, { recursive: true });
    });

    beforeEach(async () => {
        client = createClient({
            url: `file:${dbPath}`,
        });

        otherClient = createClient({
            url: `file:${bookPath}`,
        });

        await Promise.all([
            otherClient.executeMultiple(
                [
                    attachDB(categoryPath, 'categories'),
                    attachDB(authorPath, 'authors'),
                    `CREATE TABLE authors.author (id INTEGER, is_deleted TEXT, name TEXT,biography TEXT, death_text TEXT, death_number TEXT)`,
                    `CREATE TABLE main.book (id INTEGER, name TEXT, is_deleted TEXT, category TEXT, type TEXT, date TEXT, author TEXT, printed TEXT, minor_release TEXT, major_release TEXT, bibliography TEXT, hint TEXT, pdf_links TEXT, metadata TEXT)`,
                    `CREATE TABLE categories.category (id INTEGER, is_deleted TEXT, "order" TEXT, name TEXT)`,
                ].join(';'),
            ),
            createTables(client),
        ]);
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
        const selectAllFromTables = async () => {
            const [{ rows: authors }, { rows: books }, { rows: categories }] = await Promise.all([
                client.execute(`SELECT * FROM ${Tables.Authors}`),
                client.execute(`SELECT * FROM ${Tables.Books}`),
                client.execute(`SELECT * FROM ${Tables.Categories}`),
            ]);

            return { authors, books, categories };
        };

        it('should build the database from the original source tables', async () => {
            await otherClient.executeMultiple(
                [
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
                        pdf_links: 'pdf',
                        printed: '1',
                        type: '1',
                    }),
                    insertUnsafely('main.book', {
                        id: 2,
                        name: 'B',
                    }),
                    insertUnsafely('categories.category', { '`order`': '1', id: 1, name: 'Fiqh' }),
                ].join(';'),
            );

            await copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const { authors, books, categories } = await selectAllFromTables();

            expect(authors).toEqual([{ biography: 'Bio', death: 99, id: 1, name: 'Ahmad' }]);

            expect(books).toEqual([
                {
                    author: 513,
                    bibliography: 'biblio',
                    category: 1,
                    date: 1225,
                    hint: 'h',
                    id: 1,
                    major: 5,
                    metadata: '{"date":"08121431"}',
                    minor: 0,
                    name: 'B',
                    pdf_links: 'pdf',
                    printed: 1,
                    type: 1,
                },
                {
                    author: null,
                    bibliography: null,
                    category: null,
                    date: null,
                    hint: null,
                    id: 2,
                    major: null,
                    metadata: null,
                    minor: null,
                    name: 'B',
                    pdf_links: null,
                    printed: null,
                    type: null,
                },
            ]);

            expect(categories).toEqual([{ id: 1, name: 'Fiqh' }]);
        });

        it('should not include deleted records', async () => {
            await otherClient.executeMultiple(
                [
                    insertUnsafely(
                        'authors.author',
                        {
                            id: 1,
                        },
                        true,
                    ),
                    insertUnsafely(
                        'main.book',
                        {
                            id: 1,
                        },
                        true,
                    ),
                    insertUnsafely('categories.category', { id: 1 }, true),
                ].join(';'),
            );

            await copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const { authors, books, categories } = await selectAllFromTables();

            expect(authors).toHaveLength(0);
            expect(books).toHaveLength(0);
            expect(categories).toHaveLength(0);
        });

        it('should omit placeholders for unknown dates', async () => {
            await otherClient.executeMultiple(
                [
                    insertUnsafely('authors.author', {
                        death_number: UNKNOWN_DATE_PLACEHOLDER,
                        id: 1,
                    }),
                    insertUnsafely('main.book', {
                        date: UNKNOWN_DATE_PLACEHOLDER,
                        id: 1,
                    }),
                ].join(';'),
            );

            await copyForeignMasterTableData(client, [bookPath, categoryPath, authorPath]);

            const { authors, books } = await selectAllFromTables();

            expect(authors).toEqual([expect.objectContaining({ death: null })]);
            expect(books).toEqual([expect.objectContaining({ date: null })]);
        });
    });
});
