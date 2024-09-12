import { Client } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';

import { attachDB } from './queryBuilder';

export const UNKNOWN_DATE = '99999';

export const createTables = async (db: Client) => {
    const sqlStatements = await fs.readFile(path.join('scripts', 'create_master.sql'), 'utf-8');

    await db.executeMultiple(sqlStatements);
};

export const copyForeignMasterTableData = async (db: Client, sourceTables: string[]) => {
    const aliasToPath: Record<string, string> = sourceTables.reduce((acc, tablePath) => {
        const { name } = path.parse(tablePath);
        return { ...acc, [name]: tablePath };
    }, {});

    const attachStatements: string[] = Object.entries(aliasToPath).map(([alias, dbPath]) => {
        return attachDB(dbPath, alias);
    });

    const insertStatements: string[] = [
        `INSERT INTO authors SELECT id,name,biography,(CASE WHEN death_number = ${UNKNOWN_DATE} THEN NULL ELSE death_number END) AS death_number FROM author WHERE is_deleted='0'`,
        `INSERT INTO books SELECT id,name,category,type,(CASE WHEN date = ${UNKNOWN_DATE} THEN NULL ELSE date END) AS date,author,printed,major_release,minor_release,bibliography,hint,pdf_links,metadata FROM book WHERE is_deleted='0'`,
        `INSERT INTO categories SELECT id,name FROM category WHERE is_deleted='0'`,
    ];

    const detachStatements: string[] = Object.keys(aliasToPath).map((alias) => `DETACH DATABASE ${alias}`);

    const combinedStatements = attachStatements.concat(insertStatements).concat(detachStatements);

    await db.executeMultiple(combinedStatements.join(';'));
};
