import { Database } from 'bun:sqlite';
import path from 'node:path';

import type { Author, Book, Category, MasterData } from '../types';
import { attachDB, detachDB } from './queryBuilder';
import { Tables } from './types';

const ensureTableSchema = (db: Database, alias: string, table: Tables) => {
    const row = db
        .query(`SELECT sql FROM ${alias}.sqlite_master WHERE type='table' AND name = ?1`)
        .get(table) as { sql: string } | undefined;

    if (!row?.sql) {
        throw new Error(`Missing table definition for ${table} in ${alias}`);
    }

    db.run(`DROP TABLE IF EXISTS ${table}`);
    db.run(row.sql);
};

/**
 * Copies data from foreign master table files into the main master database.
 *
 * This function processes the source table files (author.sqlite, book.sqlite, category.sqlite)
 * by attaching them to the current database connection, then copying their data into
 * the main master database tables. It handles data transformation including filtering
 * out deleted records and converting placeholder values.
 *
 * @param db - The database client instance for the master database
 * @param sourceTables - Array of file paths to the source SQLite table files
 *
 * @throws {Error} When source files cannot be attached or data copying operations fail
 */
export const copyForeignMasterTableData = (db: Database, sourceTables: string[]) => {
    const aliasToPath: Record<string, string> = sourceTables.reduce((acc, tablePath) => {
        const { name } = path.parse(tablePath);
        return { ...acc, [name]: tablePath };
    }, {});

    Object.entries(aliasToPath).forEach(([alias, dbPath]) => db.run(attachDB(dbPath, alias)));

    ensureTableSchema(db, Tables.Authors, Tables.Authors);
    ensureTableSchema(db, Tables.Books, Tables.Books);
    ensureTableSchema(db, Tables.Categories, Tables.Categories);

    const insertAuthors = db.prepare(
        `INSERT INTO ${Tables.Authors} SELECT * FROM ${Tables.Authors}.${Tables.Authors}`,
    );
    const insertBooks = db.prepare(
        `INSERT INTO ${Tables.Books} SELECT * FROM ${Tables.Books}.${Tables.Books}`,
    );
    const insertCategories = db.prepare(
        `INSERT INTO ${Tables.Categories} SELECT * FROM ${Tables.Categories}.${Tables.Categories}`,
    );

    db.transaction(() => {
        insertAuthors.run();
        insertBooks.run();
        insertCategories.run();
    })();

    Object.keys(aliasToPath).forEach((statement) => db.run(detachDB(statement)));
};

/**
 * Creates the necessary database tables for the master database.
 *
 * This function sets up the schema for the master database by creating
 * tables for authors, books, and categories with their respective columns
 * and data types. This is typically the first step in setting up a new
 * master database.
 *
 * @param db - The database client instance where tables should be created
 *
 * @throws {Error} When table creation fails due to database constraints or permissions
 */
const createCompatibilityView = (db: Database, viewName: string, sourceTable: Tables) => {
    db.run(`DROP VIEW IF EXISTS ${viewName}`);
    db.run(`CREATE VIEW ${viewName} AS SELECT * FROM ${sourceTable}`);
};

export const createTables = (db: Database) => {
    db.run(
        `CREATE TABLE ${Tables.Authors} (
            id INTEGER,
            is_deleted TEXT,
            name TEXT,
            biography TEXT,
            death_text TEXT,
            death_number TEXT
        )`,
    );
    db.run(
        `CREATE TABLE ${Tables.Books} (
            id INTEGER,
            name TEXT,
            is_deleted TEXT,
            category TEXT,
            type TEXT,
            date TEXT,
            author TEXT,
            printed TEXT,
            minor_release TEXT,
            major_release TEXT,
            bibliography TEXT,
            hint TEXT,
            pdf_links TEXT,
            metadata TEXT
        )`,
    );
    db.run(
        `CREATE TABLE ${Tables.Categories} (
            id INTEGER,
            is_deleted TEXT,
            "order" TEXT,
            name TEXT
        )`,
    );

    // Provide backward-compatible pluralised views since callers historically
    // queried "authors", "books", and "categories" tables.
    createCompatibilityView(db, 'authors', Tables.Authors);
    createCompatibilityView(db, 'books', Tables.Books);
    createCompatibilityView(db, 'categories', Tables.Categories);
};

export const getAllAuthors = (db: Database) => {
    return db.query(`SELECT * FROM ${Tables.Authors}`).all() as Author[];
};

export const getAllBooks = (db: Database) => {
    return db.query(`SELECT * FROM ${Tables.Books}`).all() as Book[];
};

export const getAllCategories = (db: Database) => {
    return db.query(`SELECT * FROM ${Tables.Categories}`).all() as Category[];
};

export const getData = (db: Database) => {
    return { authors: getAllAuthors(db), books: getAllBooks(db), categories: getAllCategories(db) } as MasterData;
};
