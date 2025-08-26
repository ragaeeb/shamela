import { Database } from 'bun:sqlite';

export type InternalTable = {
    fields: string[];
    name: string;
};

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
export const getInternalTables = (db: Database, dbName: string) => {
    const tables = db.query(`SELECT name,sql FROM ${dbName}.sqlite_master WHERE type='table'`).all() as {
        name: string;
        sql: string;
    }[];

    return tables.map((row) => {
        const fields = row.sql.split(', ').map((field: string) => field.split(' ')[0]);

        return { fields, name: row.name } as InternalTable;
    });
};
