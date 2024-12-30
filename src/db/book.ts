import { Client } from '@libsql/client';

import { BookData, Page, Title } from '../types';
import logger from '../utils/logger';
import { getInternalTables, InternalTable, selectAllRows } from './common';
import { attachDB, buildPagePatchQuery, buildTitlePatchQuery, detachDB } from './queryBuilder';
import { PageRow, Tables, TitleRow } from './types';

const PATCH_DB_ALIAS = 'patch';
const ASL_DB_ALIAS = 'asl';

const buildCopyStatements = (
    patchTables: InternalTable[],
    aslTables: InternalTable[],
    table: Tables,
    fields: string[],
    patchQuery: string,
): string[] => {
    const statements = [];

    if (patchTables.find((t) => t.name === table)) {
        statements.push(
            `INSERT INTO main.${table} SELECT ${fields.join(',')} FROM ${ASL_DB_ALIAS}.${table} WHERE id IN (SELECT id FROM ${PATCH_DB_ALIAS}.${table} WHERE is_deleted='0')`,
        );
        statements.push(patchQuery);
    } else {
        let copyStatement = `INSERT INTO main.${table} SELECT ${fields.join(',')} FROM ${ASL_DB_ALIAS}.${table}`;

        if (aslTables.find((t) => t.name === table)?.fields.includes('is_deleted')) {
            copyStatement += ` WHERE is_deleted='0'`;
        }

        statements.push(copyStatement);
    }

    return statements;
};

export const applyPatches = async (db: Client, aslDB: string, patchDB: string) => {
    await Promise.all([db.execute(attachDB(aslDB, ASL_DB_ALIAS)), db.execute(attachDB(patchDB, PATCH_DB_ALIAS))]);

    const [patchTables, aslTables] = await Promise.all([
        getInternalTables(db, PATCH_DB_ALIAS),
        getInternalTables(db, ASL_DB_ALIAS),
    ]);

    logger.debug({ aslTables, patchTables }, `Applying patches for...`);

    await db.batch([
        ...buildCopyStatements(
            patchTables,
            aslTables,
            Tables.Page,
            ['id', 'content', 'part', 'page', 'number'],
            buildPagePatchQuery(PATCH_DB_ALIAS, Tables.Page),
        ),
        ...buildCopyStatements(
            patchTables,
            aslTables,
            Tables.Title,
            ['id', 'content', 'page', 'parent'],
            buildTitlePatchQuery(PATCH_DB_ALIAS, Tables.Title),
        ),
    ]);

    return db.batch([detachDB(ASL_DB_ALIAS), detachDB(PATCH_DB_ALIAS)]);
};

export const copyTableData = async (db: Client, aslDB: string) => {
    await db.execute(attachDB(aslDB, ASL_DB_ALIAS));
    const tables = await getInternalTables(db, ASL_DB_ALIAS);

    logger.debug({ tables }, `Applying patches for...`);

    await db.batch([
        `INSERT INTO main.${Tables.Title} SELECT id,content,page,parent FROM ${ASL_DB_ALIAS}.${Tables.Title}`,
        `INSERT INTO main.${Tables.Page} SELECT id,content,part,page,number FROM ${ASL_DB_ALIAS}.${Tables.Page}`,
    ]);

    return db.execute(detachDB(ASL_DB_ALIAS));
};

export const createTables = async (db: Client) => {
    return db.batch([
        `CREATE TABLE page (id INTEGER PRIMARY KEY, content TEXT, part INTEGER, page INTEGER, number INTEGER)`,
        `CREATE TABLE title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER)`,
    ]);
};

export const getAllPages = async (db: Client): Promise<Page[]> => {
    const rows = await selectAllRows(db, Tables.Page);

    const pages: Page[] = rows.map((row: any) => {
        const { content, id, number, page, part } = row as PageRow;

        return {
            content,
            id,
            ...(page && { page }),
            ...(number && { number }),
            ...(part && { part }),
        };
    });

    return pages;
};

export const getAllTitles = async (db: Client): Promise<Title[]> => {
    const rows = await selectAllRows(db, Tables.Title);

    const titles: Title[] = rows.map((row: any) => {
        const r = row as TitleRow;

        return {
            content: r.content,
            id: r.id,
            page: r.page,
            ...(r.parent && { number: r.parent }),
        };
    });

    return titles;
};

export const getData = async (db: Client): Promise<BookData> => {
    const [pages, titles] = await Promise.all([getAllPages(db), getAllTitles(db)]);
    return { pages, titles };
};
