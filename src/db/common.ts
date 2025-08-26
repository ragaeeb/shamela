import { Database } from 'bun:sqlite';

export type InternalTable = {
    fields: string[];
    name: string;
};

const escapeAsSqlString = (v: string) => `'${v.replace(/'/g, "''")}'`; // safe string literal

/**
 * Retrieves information about internal tables in a specified database.
 *
 * This function queries the SQLite master table to get metadata about all
 * tables in the specified database, including table names and field information.
 * It's useful for database introspection and validation operations.
 *
 * @param db - The database client instance to query
 * @param dbName - The name/alias of the database to inspect (e.g., 'main', 'patch')
 * @returns An array of InternalTable objects containing table metadata
 *
 * @throws {Error} When database query fails or table metadata cannot be parsed
 */

export const getInternalTables = (db: Database, dbName: string): InternalTable[] => {
    // Allow-list/validate schema name to prevent SQL injection (e.g., 'main', 'temp', 'patch')
    const isValidIdent = (v: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
    if (!isValidIdent(dbName)) {
        throw new Error(`Invalid database name: ${dbName}`);
    }

    // Get only user tables; exclude SQLite internal tables
    const tables = db
        .query(`SELECT name FROM ${dbName}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
        .all() as { name: string }[];

    return tables.map(({ name }) => {
        const tableExpr = isValidIdent(name) ? name : escapeAsSqlString(name);
        // Use PRAGMA table_info to reliably fetch column names
        const cols = db.query(`PRAGMA ${dbName}.table_info(${tableExpr})`).all() as { name: string }[];
        const fields = cols.map((c) => c.name);
        return { fields, name } as InternalTable;
    });
};
