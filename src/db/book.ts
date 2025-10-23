import logger from '@/utils/logger';
import type { SqliteDatabase } from './sqlite';
import { type Deletable, type PageRow, Tables, type TitleRow } from './types';

type Row = Record<string, any> & Deletable;

const PATCH_NOOP_VALUE = '#';

/**
 * Retrieves column information for a specified table.
 * @param db - The database instance
 * @param table - The table name to get info for
 * @returns Array of column information with name and type
 */
const getTableInfo = (db: SqliteDatabase, table: Tables) => {
    return db.query(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[];
};

/**
 * Checks if a table exists in the database.
 * @param db - The database instance
 * @param table - The table name to check
 * @returns True if the table exists, false otherwise
 */
const hasTable = (db: SqliteDatabase, table: Tables): boolean => {
    const result = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?1`).get(table) as
        | { name: string }
        | undefined;
    return Boolean(result);
};

/**
 * Reads all rows from a specified table.
 * @param db - The database instance
 * @param table - The table name to read from
 * @returns Array of rows, or empty array if table doesn't exist
 */
const readRows = (db: SqliteDatabase, table: Tables): Row[] => {
    if (!hasTable(db, table)) {
        return [];
    }

    return db.query(`SELECT * FROM ${table}`).all() as Row[];
};

/**
 * Checks if a row is marked as deleted.
 * @param row - The row to check
 * @returns True if the row has is_deleted field set to '1', false otherwise
 */
const isDeleted = (row: Row): boolean => {
    return String(row.is_deleted) === '1';
};

/**
 * Merges values from a base row and patch row, with patch values taking precedence.
 * @param baseRow - The original row data (can be undefined)
 * @param patchRow - The patch row data with updates (can be undefined)
 * @param columns - Array of column names to merge
 * @returns Merged row with combined values
 */
const mergeRowValues = (baseRow: Row | undefined, patchRow: Row | undefined, columns: string[]): Row => {
    const merged: Row = {};

    for (const column of columns) {
        if (column === 'id') {
            merged.id = (patchRow ?? baseRow)?.id ?? null;
            continue;
        }

        if (patchRow && column in patchRow) {
            const value = patchRow[column];

            if (value !== PATCH_NOOP_VALUE && value !== null && value !== undefined) {
                merged[column] = value;
                continue;
            }
        }

        if (baseRow && column in baseRow) {
            merged[column] = baseRow[column];
            continue;
        }

        merged[column] = null;
    }

    return merged;
};

/**
 * Merges arrays of base rows and patch rows, handling deletions and updates.
 * @param baseRows - Original rows from the base database
 * @param patchRows - Patch rows containing updates, additions, and deletions
 * @param columns - Array of column names to merge
 * @returns Array of merged rows with patches applied
 */
const mergeRows = (baseRows: Row[], patchRows: Row[], columns: string[]): Row[] => {
    const baseIds = new Set<string>();
    const patchById = new Map<string, Row>();

    for (const row of baseRows) {
        baseIds.add(String(row.id));
    }

    for (const row of patchRows) {
        patchById.set(String(row.id), row);
    }

    const merged: Row[] = [];

    for (const baseRow of baseRows) {
        const patchRow = patchById.get(String(baseRow.id));

        if (patchRow && isDeleted(patchRow)) {
            continue;
        }

        merged.push(mergeRowValues(baseRow, patchRow, columns));
    }

    for (const row of patchRows) {
        const id = String(row.id);

        if (baseIds.has(id) || isDeleted(row)) {
            continue;
        }

        merged.push(mergeRowValues(undefined, row, columns));
    }

    return merged;
};

/**
 * Inserts multiple rows into a specified table using a prepared statement.
 * @param db - The database instance
 * @param table - The table name to insert into
 * @param columns - Array of column names
 * @param rows - Array of row data to insert
 */
const insertRows = (db: SqliteDatabase, table: Tables, columns: string[], rows: Row[]) => {
    if (rows.length === 0) {
        return;
    }

    const placeholders = columns.map(() => '?').join(',');
    const statement = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);

    rows.forEach((row) => {
        const values = columns.map((column) => (column in row ? row[column] : null));
        // Spread the values array instead of passing it directly
        statement.run(...values);
    });

    statement.finalize();
};

/**
 * Ensures the target database has the same table schema as the source database.
 * @param target - The target database to create/update the table in
 * @param source - The source database to copy the schema from
 * @param table - The table name to ensure schema for
 * @returns True if schema was successfully ensured, false otherwise
 */
const ensureTableSchema = (target: SqliteDatabase, source: SqliteDatabase, table: Tables) => {
    const row = source.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?1`).get(table) as
        | { sql: string }
        | undefined;

    if (!row?.sql) {
        logger.warn(`${table} table definition missing in source database`);
        return false;
    }

    target.run(`DROP TABLE IF EXISTS ${table}`);
    target.run(row.sql);
    return true;
};

/**
 * Copies and patches a table from source to target database, applying patch updates if provided.
 * @param target - The target database to copy/patch the table to
 * @param source - The source database containing the base table data
 * @param patch - Optional patch database containing updates (can be null)
 * @param table - The table name to copy and patch
 */
const copyAndPatchTable = (
    target: SqliteDatabase,
    source: SqliteDatabase,
    patch: SqliteDatabase | null,
    table: Tables,
) => {
    if (!hasTable(source, table)) {
        logger.warn(`${table} table missing in source database`);
        return;
    }

    if (!ensureTableSchema(target, source, table)) {
        return;
    }

    const baseInfo = getTableInfo(source, table);
    const patchInfo = patch && hasTable(patch, table) ? getTableInfo(patch, table) : [];

    const columns = baseInfo.map((info) => info.name);

    for (const info of patchInfo) {
        if (!columns.includes(info.name)) {
            const columnType = info.type && info.type.length > 0 ? info.type : 'TEXT';
            target.run(`ALTER TABLE ${table} ADD COLUMN ${info.name} ${columnType}`);
            columns.push(info.name);
        }
    }

    const baseRows = readRows(source, table);
    const patchRows = patch ? readRows(patch, table) : [];

    const mergedRows = mergeRows(baseRows, patchRows, columns);

    insertRows(target, table, columns, mergedRows);
};

/**
 * Applies patches from a patch database to the main database.
 * @param db - The target database to apply patches to
 * @param aslDB - Path to the source ASL database file
 * @param patchDB - Path to the patch database file
 */
export const applyPatches = (db: SqliteDatabase, source: SqliteDatabase, patch: SqliteDatabase) => {
    db.transaction(() => {
        copyAndPatchTable(db, source, patch, Tables.Page);
        copyAndPatchTable(db, source, patch, Tables.Title);
    })();
};

/**
 * Copies table data from a source database without applying any patches.
 * @param db - The target database to copy data to
 * @param aslDB - Path to the source ASL database file
 */
export const copyTableData = (db: SqliteDatabase, source: SqliteDatabase) => {
    db.transaction(() => {
        copyAndPatchTable(db, source, null, Tables.Page);
        copyAndPatchTable(db, source, null, Tables.Title);
    })();
};

/**
 * Creates the required tables (Page and Title) in the database with their schema.
 * @param db - The database instance to create tables in
 */
export const createTables = (db: SqliteDatabase) => {
    db.run(
        `CREATE TABLE ${Tables.Page} (
            id INTEGER,
            content TEXT,
            part TEXT,
            page TEXT,
            number TEXT,
            services TEXT,
            is_deleted TEXT
        )`,
    );
    db.run(
        `CREATE TABLE ${Tables.Title} (
            id INTEGER,
            content TEXT,
            page INTEGER,
            parent INTEGER,
            is_deleted TEXT
        )`,
    );
};

/**
 * Retrieves all pages from the Page table.
 * @param db - The database instance
 * @returns Array of all pages
 */
export const getAllPages = (db: SqliteDatabase) => {
    return db.query(`SELECT * FROM ${Tables.Page}`).all() as PageRow[];
};

/**
 * Retrieves all titles from the Title table.
 * @param db - The database instance
 * @returns Array of all titles
 */
export const getAllTitles = (db: SqliteDatabase) => {
    return db.query(`SELECT * FROM ${Tables.Title}`).all() as TitleRow[];
};

/**
 * Retrieves all book data including pages and titles.
 * @param db - The database instance
 * @returns Object containing arrays of pages and titles
 */
export const getData = (db: SqliteDatabase) => {
    return { pages: getAllPages(db), titles: getAllTitles(db) };
};
