import { Client } from '@libsql/client';
import path from 'path';

import { attachDB, createTable } from './queryBuilder';
import { Tables } from './types';

export const UNKNOWN_DATE = '99999';

export const createMasterTables = async (db: Client) => {
    const statements: string[] = [
        createTable(Tables.Authors, ['id INTEGER PRIMARY KEY', 'name TEXT', 'biography TEXT', 'death INTEGER']),
        createTable(Tables.Books, [
            'id INTEGER PRIMARY KEY',
            'name TEXT',
            'category INTEGER',
            'type INTEGER',
            'date INTEGER',
            'author INTEGER',
            'printed INTEGER',
            'major INTEGER',
            'minor INTEGER',
            'bibliography TEXT',
            'hint TEXT',
            'pdf_links TEXT',
            'metadata TEXT',
        ]),
        createTable(Tables.Categories, ['id INTEGER PRIMARY KEY', 'name TEXT']),
    ];

    await db.executeMultiple(statements.join(';'));
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
