import { Client } from '@libsql/client';

import { BookData, Page, Title } from '../types';
import logger from '../utils/logger';
import { getInternalTables, InternalTable, selectAllRows } from './common';
import { attachDB, buildPagePatchQuery, buildTitlePatchQuery, detachDB } from './queryBuilder';
import { PageRow, Tables, TitleRow } from './types';

const PATCH_DB_ALIAS = 'patch';
const ASL_DB_ALIAS = 'asl';

const getPagesToCopy = (tables: InternalTable[]): string[] => {
    const statements = [];

    if (tables.find((t) => t.name === Tables.Page)) {
        statements.push(
            `INSERT INTO main.${Tables.Page} SELECT id,content,part,page,number FROM ${ASL_DB_ALIAS}.${Tables.Page} WHERE id IN (SELECT id FROM ${PATCH_DB_ALIAS}.${Tables.Page} WHERE is_deleted='0')`,
        );
        statements.push(buildPagePatchQuery(PATCH_DB_ALIAS, Tables.Page));
    } else {
        statements.push(
            `INSERT INTO main.${Tables.Page} SELECT id,content,part,page,number FROM ${ASL_DB_ALIAS}.${Tables.Page} WHERE is_deleted='0'`,
        );
    }

    return statements;
};

const getTitlesToCopy = (tables: InternalTable[]): string[] => {
    const statements = [];

    if (tables.find((t) => t.name === Tables.Title)) {
        statements.push(
            `INSERT INTO main.${Tables.Title} SELECT id,content,page,parent FROM ${ASL_DB_ALIAS}.${Tables.Title} WHERE id IN (SELECT id FROM ${PATCH_DB_ALIAS}.${Tables.Title} WHERE is_deleted='0')`,
        );
        statements.push(buildTitlePatchQuery(PATCH_DB_ALIAS, Tables.Title));
    } else {
        statements.push(
            `INSERT INTO main.${Tables.Title} SELECT id,content,page,parent FROM ${ASL_DB_ALIAS}.${Tables.Title} WHERE is_deleted='0'`,
        );
    }

    return statements;
};

export const applyPatches = async (db: Client, aslDB: string, patchDB?: string) => {
    const statements: string[] = [attachDB(aslDB, ASL_DB_ALIAS)];

    if (patchDB) {
        await db.execute(attachDB(patchDB, PATCH_DB_ALIAS));
    }

    const tables = patchDB ? await getInternalTables(db, PATCH_DB_ALIAS) : [];

    logger.debug({ tables }, `Applying patches for...`);

    statements.push(...getPagesToCopy(tables));
    statements.push(...getTitlesToCopy(tables));

    await db.batch(statements);

    const detachStatements = [];
    detachStatements.push(detachDB(ASL_DB_ALIAS));

    if (patchDB) {
        detachStatements.push(detachDB(PATCH_DB_ALIAS));
    }

    return db.batch(detachStatements);
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
