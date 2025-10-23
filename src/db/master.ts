import type { Author, Book, Category, MasterData } from '../types';
import type { SqliteDatabase } from './sqlite';
import { openDatabase } from './sqlite';
import { Tables } from './types';

/**
 * Ensures the target database has the same table schema as the source database for a specific table.
 * @param db - The database instance
 * @param alias - The alias name of the attached database
 * @param table - The table name to ensure schema for
 * @throws {Error} When table definition is missing in the source database
 */
const ensureTableSchema = (db: SqliteDatabase, source: SqliteDatabase, table: Tables) => {
    const row = source.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?1`).get(table) as
        | { sql: string }
        | undefined;

    if (!row?.sql) {
        throw new Error(`Missing table definition for ${table} in source database`);
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
export const copyForeignMasterTableData = async (
    db: SqliteDatabase,
    sourceTables: Array<{ name: string; data: Uint8Array }>,
) => {
    const TABLE_MAP: Record<string, Tables> = {
        author: Tables.Authors,
        book: Tables.Books,
        category: Tables.Categories,
    };

    const tableDbs: Partial<Record<Tables, SqliteDatabase>> = {};

    for (const table of sourceTables) {
        const baseName = table.name.split('/').pop()?.split('\\').pop() ?? table.name;
        const normalized = baseName.replace(/\.(sqlite|db)$/i, '').toLowerCase();
        const tableName = TABLE_MAP[normalized];
        if (!tableName) {
            continue;
        }

        tableDbs[tableName] = await openDatabase(table.data);
    }

    try {
        const entries = Object.entries(tableDbs) as Array<[Tables, SqliteDatabase]>;

        db.transaction(() => {
            for (const [table, sourceDb] of entries) {
                ensureTableSchema(db, sourceDb, table);

                const columnInfo = sourceDb.query(`PRAGMA table_info(${table})`).all() as Array<{
                    name: string;
                    type: string;
                }>;
                const columnNames = columnInfo.map((info) => info.name);
                if (columnNames.length === 0) {
                    continue;
                }

                const rows = sourceDb.query(`SELECT * FROM ${table}`).all();
                if (rows.length === 0) {
                    continue;
                }

                const placeholders = columnNames.map(() => '?').join(',');
                const sqlColumns = columnNames.map((name) => (name === 'order' ? '"order"' : name));
                const statement = db.prepare(`INSERT INTO ${table} (${sqlColumns.join(',')}) VALUES (${placeholders})`);

                try {
                    for (const row of rows) {
                        const values = columnNames.map((column) => (column in row ? row[column] : null));
                        statement.run(...values);
                    }
                } finally {
                    statement.finalize();
                }
            }
        })();
    } finally {
        Object.values(tableDbs).forEach((database) => database?.close());
    }
};

/**
 * Creates a backward-compatible database view for legacy table names.
 * @param db - The database instance
 * @param viewName - The name of the view to create
 * @param sourceTable - The source table to base the view on
 */
const createCompatibilityView = (db: SqliteDatabase, viewName: string, sourceTable: Tables) => {
    db.run(`DROP VIEW IF EXISTS ${viewName}`);
    db.run(`CREATE VIEW ${viewName} AS SELECT * FROM ${sourceTable}`);
};

/**
 * Creates the necessary database tables for the master database.
 *
 * This function sets up the schema for the master database by creating
 * tables for authors, books, and categories with their respective columns
 * and data types. This is typically the first step in setting up a new
 * master database. Also creates backward-compatible views for legacy table names.
 *
 * @param db - The database client instance where tables should be created
 *
 * @throws {Error} When table creation fails due to database constraints or permissions
 */
export const createTables = (db: SqliteDatabase) => {
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

/**
 * Retrieves all authors from the Authors table.
 * @param db - The database instance
 * @returns Array of all authors
 */
export const getAllAuthors = (db: SqliteDatabase) => {
    return db.query(`SELECT * FROM ${Tables.Authors}`).all() as Author[];
};

/**
 * Retrieves all books from the Books table.
 * @param db - The database instance
 * @returns Array of all books
 */
export const getAllBooks = (db: SqliteDatabase) => {
    return db.query(`SELECT * FROM ${Tables.Books}`).all() as Book[];
};

/**
 * Retrieves all categories from the Categories table.
 * @param db - The database instance
 * @returns Array of all categories
 */
export const getAllCategories = (db: SqliteDatabase) => {
    return db.query(`SELECT * FROM ${Tables.Categories}`).all() as Category[];
};

/**
 * Retrieves all master data including authors, books, and categories.
 * @param db - The database instance
 * @returns Object containing arrays of authors, books, and categories
 */
export const getData = (db: SqliteDatabase, version: number) => {
    return {
        authors: getAllAuthors(db),
        books: getAllBooks(db),
        categories: getAllCategories(db),
        version,
    } satisfies MasterData;
};
