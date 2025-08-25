import { Client } from '@libsql/client';
import path from 'path';

import { Author, Book, Category, MasterData, PDFLinks } from '../types';
import { UNKNOWN_VALUE_PLACEHOLDER } from '../utils/constants';
import { selectAllRows } from './common';
import { attachDB, detachDB } from './queryBuilder';
import { BookRow, Tables } from './types';

/**
 * Copies data from foreign master table files into the main master database.
 *
 * This function processes the source table files (author.sqlite, book.sqlite, category.sqlite)
 * by attaching them to the current database connection, then copying their data into
 * the main master database tables. It handles data transformation including filtering
 * out deleted records and converting placeholder values.
 *
 * @param db - The libSQL client instance for the master database
 * @param sourceTables - Array of file paths to the source SQLite table files
 * @returns A promise that resolves when all data has been copied successfully
 *
 * @throws {Error} When source files cannot be attached or data copying operations fail
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./master.db' });
 * const sources = ['./author.sqlite', './book.sqlite', './category.sqlite'];
 * await copyForeignMasterTableData(client, sources);
 * ```
 */
export const copyForeignMasterTableData = async (db: Client, sourceTables: string[]) => {
    const aliasToPath: Record<string, string> = sourceTables.reduce((acc, tablePath) => {
        const { name } = path.parse(tablePath);
        return { ...acc, [name]: tablePath };
    }, {});

    const attachStatements: string[] = Object.entries(aliasToPath).map(([alias, dbPath]) => attachDB(dbPath, alias));
    await db.batch(attachStatements);

    const insertStatements: string[] = [
        `INSERT INTO ${Tables.Authors} SELECT id,name,biography,(CASE WHEN death_number = ${UNKNOWN_VALUE_PLACEHOLDER} THEN NULL ELSE death_number END) AS death_number FROM author WHERE is_deleted='0'`,
        `INSERT INTO ${Tables.Books} SELECT id,name,category,type,(CASE WHEN date = ${UNKNOWN_VALUE_PLACEHOLDER} THEN NULL ELSE date END) AS date,author,printed,major_release,minor_release,bibliography,hint,pdf_links,metadata FROM book WHERE is_deleted='0'`,
        `INSERT INTO ${Tables.Categories} SELECT id,name FROM category WHERE is_deleted='0'`,
    ];
    await db.batch(insertStatements);

    const detachStatements: string[] = Object.keys(aliasToPath).map(detachDB);
    await db.batch(detachStatements);
};

/**
 * Creates the necessary database tables for the master database.
 *
 * This function sets up the schema for the master database by creating
 * tables for authors, books, and categories with their respective columns
 * and data types. This is typically the first step in setting up a new
 * master database.
 *
 * @param db - The libSQL client instance where tables should be created
 * @returns A promise that resolves when all tables are successfully created
 *
 * @throws {Error} When table creation fails due to database constraints or permissions
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./master.db' });
 * await createTables(client);
 * ```
 */
export const createTables = async (db: Client) => {
    return db.batch([
        `CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, biography TEXT, death INTEGER)`,
        `CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT, category INTEGER, type INTEGER, date INTEGER, author TEXT, printed INTEGER, major INTEGER, minor INTEGER, bibliography TEXT, hint TEXT, pdf_links TEXT, metadata TEXT)`,
        `CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT)`,
    ]);
};

export const getAllAuthors = async (db: Client): Promise<Author[]> => {
    const rows = await selectAllRows(db, Tables.Authors);

    const authors: Author[] = rows.map((r: any) => ({
        ...(r.biography && { biography: r.biography }),
        ...(r.death && { death: r.death }),
        id: r.id,
        name: r.name,
    }));

    return authors;
};

export const getAllBooks = async (db: Client): Promise<Book[]> => {
    const rows = await selectAllRows(db, Tables.Books);

    const books: Book[] = rows.map((row: any) => {
        const r = row as BookRow;

        return {
            author: parseAuthor(r.author),
            bibliography: r.bibliography,
            category: r.category,
            id: r.id,
            major: r.major,
            metadata: JSON.parse(r.metadata),
            name: r.name,
            printed: r.printed,
            type: r.type,
            ...(r.date && r.date.toString() !== UNKNOWN_VALUE_PLACEHOLDER && { date: r.date }),
            ...(r.hint && { hint: r.hint }),
            ...(r.pdf_links && { pdfLinks: parsePdfLinks(r.pdf_links) }),
            ...(r.minor && { minorRelease: r.minor }),
        };
    });

    return books;
};

export const getAllCategories = async (db: Client): Promise<Category[]> => {
    const rows = await selectAllRows(db, Tables.Categories);

    const categories: Category[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
    }));

    return categories;
};

const parseAuthor = (value: string): number | number[] => {
    const result: number[] = value.split(',\\s+').map((id) => parseInt(id.trim()));
    return result.length > 1 ? result : result[0];
};

const parsePdfLinks = (value: string): PDFLinks => {
    const result = JSON.parse(value);

    if (result.files) {
        result.files = (result.files as string[]).map((f: string) => {
            const [file, id] = f.split('|');
            return { ...(id && { id }), file };
        });
    }

    return result as PDFLinks;
};

export const getData = async (db: Client): Promise<MasterData> => {
    const [authors, books, categories] = await Promise.all([getAllAuthors(db), getAllBooks(db), getAllCategories(db)]);
    return { authors, books, categories };
};
