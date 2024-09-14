import { Client, Row } from '@libsql/client';

export const selectAllRows = async (client: Client, table: string): Promise<Row[]> => {
    const { rows } = await client.execute(`SELECT * FROM ${table}`);
    return rows;
};
