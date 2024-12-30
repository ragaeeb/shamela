import { Client, Row } from '@libsql/client';

export type InternalTable = {
    fields: string[];
    name: string;
};

export const getInternalTables = async (db: Client, dbName: string): Promise<InternalTable[]> => {
    const { rows: tables } = await db.execute(`SELECT name,sql FROM ${dbName}.sqlite_master WHERE type='table'`);

    return tables.map((row: any) => {
        const fields = row.sql.split(', ').map((field: string) => field.split(' ')[0]);

        return { fields, name: row.name };
    });
};

export const selectAllRows = async (client: Client, table: string): Promise<Row[]> => {
    const { rows } = await client.execute(`SELECT * FROM ${table}`);
    return rows;
};
