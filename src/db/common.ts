import { Client, Row } from '@libsql/client';

export type InternalTable = {
    name: string;
};

export const getInternalTables = async (db: Client, dbName: string): Promise<InternalTable[]> => {
    const { rows: tables } = await db.execute(`SELECT name FROM ${dbName}.sqlite_master WHERE type='table'`);

    return tables as unknown as InternalTable[];
};

export const selectAllRows = async (client: Client, table: string): Promise<Row[]> => {
    const { rows } = await client.execute(`SELECT * FROM ${table}`);
    return rows;
};
