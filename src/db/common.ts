import { Client, Row } from '@libsql/client';

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
 * @param db - The libSQL client instance to query
 * @param dbName - The name/alias of the database to inspect (e.g., 'main', 'patch')
 * @returns A promise that resolves to an array of InternalTable objects containing table metadata
 *
 * @throws {Error} When database query fails or table metadata cannot be parsed
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./database.db' });
 * const tables = await getInternalTables(client, 'main');
 * console.log(tables[0].name); // Table name
 * console.log(tables[0].fields); // Array of field names
 * ```
 */
export const getInternalTables = async (db: Client, dbName: string): Promise<InternalTable[]> => {
    const { rows: tables } = await db.execute(`SELECT name,sql FROM ${dbName}.sqlite_master WHERE type='table'`);

    return tables.map((row: any) => {
        const fields = row.sql.split(', ').map((field: string) => field.split(' ')[0]);

        return { fields, name: row.name };
    });
};

/**
 * Selects all rows from a specified table.
 *
 * This is a utility function that executes a SELECT * query on the given table
 * and returns all rows. It's commonly used for data extraction and migration
 * operations throughout the application.
 *
 * @param client - The libSQL client instance to use for the query
 * @param table - The name of the table to query
 * @returns A promise that resolves to an array of Row objects containing all table data
 *
 * @throws {Error} When the table doesn't exist or the query fails
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./database.db' });
 * const rows = await selectAllRows(client, 'books');
 * console.log(rows.length); // Number of rows in the table
 * ```
 */
export const selectAllRows = async (client: Client, table: string): Promise<Row[]> => {
    const { rows } = await client.execute(`SELECT * FROM ${table}`);
    return rows;
};
