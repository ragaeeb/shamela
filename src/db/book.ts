import { Database } from 'bun:sqlite';

import type { BookData, Page, Title } from '../types';
import logger from '../utils/logger';
import { Tables } from './types';

type Row = Record<string, any>;

const PATCH_NOOP_VALUE = '#';

const getTableInfo = (db: Database, table: Tables) => {
    return db.query(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[];
};

const hasTable = (db: Database, table: Tables): boolean => {
    const result = db
        .query(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?1`)
        .get(table) as { name: string } | undefined;
    return Boolean(result);
};

const readRows = (db: Database, table: Tables): Row[] => {
    if (!hasTable(db, table)) {
        return [];
    }

    return db.query(`SELECT * FROM ${table}`).all() as Row[];
};

const isDeleted = (row: Row): boolean => {
    if (!('is_deleted' in row)) {
        return false;
    }

    const value = row.is_deleted;
    if (value === null || value === undefined) {
        return false;
    }

    return String(value) === '1';
};

const mergeRowValues = (baseRow: Row | undefined, patchRow: Row | undefined, columns: string[]): Row => {
    const merged: Row = {};

    for (const column of columns) {
        if (column === 'id') {
            merged.id = (patchRow ?? baseRow)?.id ?? null;
            continue;
        }

        if (patchRow && Object.prototype.hasOwnProperty.call(patchRow, column)) {
            const value = patchRow[column];

            if (value !== PATCH_NOOP_VALUE && value !== null && value !== undefined) {
                merged[column] = value;
                continue;
            }
        }

        if (baseRow && Object.prototype.hasOwnProperty.call(baseRow, column)) {
            merged[column] = baseRow[column];
            continue;
        }

        merged[column] = null;
    }

    return merged;
};

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

const insertRows = (db: Database, table: Tables, columns: string[], rows: Row[]) => {
    if (rows.length === 0) {
        return;
    }

    const placeholders = columns.map(() => '?').join(',');
    const statement = db.prepare(
        `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
    );

    rows.forEach((row) => {
        const values = columns.map((column) =>
            Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null,
        );
        statement.run(values);
    });

    statement.finalize();
};

const ensureTableSchema = (target: Database, source: Database, table: Tables) => {
    const row = source
        .query(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?1`)
        .get(table) as { sql: string } | undefined;

    if (!row?.sql) {
        logger.warn(`${table} table definition missing in source database`);
        return false;
    }

    target.run(`DROP TABLE IF EXISTS ${table}`);
    target.run(row.sql);
    return true;
};

const copyAndPatchTable = (
    target: Database,
    source: Database,
    patch: Database | null,
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

export const applyPatches = (db: Database, aslDB: string, patchDB: string) => {
    const source = new Database(aslDB);
    const patch = new Database(patchDB);

    try {
        db.transaction(() => {
            copyAndPatchTable(db, source, patch, Tables.Page);
            copyAndPatchTable(db, source, patch, Tables.Title);
        })();
    } finally {
        source.close();
        patch.close();
    }
};

export const copyTableData = (db: Database, aslDB: string) => {
    const source = new Database(aslDB);

    try {
        db.transaction(() => {
            copyAndPatchTable(db, source, null, Tables.Page);
            copyAndPatchTable(db, source, null, Tables.Title);
        })();
    } finally {
        source.close();
    }
};

export const createTables = (db: Database) => {
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

export const getAllPages = (db: Database) => {
    return db.query(`SELECT * FROM ${Tables.Page}`).all() as Page[];
};

export const getAllTitles = (db: Database) => {
    return db.query(`SELECT * FROM ${Tables.Title}`).all() as Title[];
};

export const getData = (db: Database): BookData => {
    return { pages: getAllPages(db), titles: getAllTitles(db) };
};
