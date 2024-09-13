import { Client } from '@libsql/client';
import { promises as fs } from 'fs';
import path from 'path';

import logger from '../utils/logger';
import { attachDB, buildPagePatchQuery, buildTitlePatchQuery, detachDB } from './queryBuilder';
import { Tables } from './types';

const PATCH_DB_ALIAS = 'patch';
const ASL_DB_ALIAS = 'asl';

type InternalTable = {
    name: string;
};

export const createTables = async (db: Client) => {
    const sqlStatements = await fs.readFile(path.join('scripts', 'create_book.sql'), 'utf-8');
    await db.executeMultiple(sqlStatements);
};

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

    const { rows: tables } = patchDB
        ? await db.execute(`SELECT name FROM ${PATCH_DB_ALIAS}.sqlite_master WHERE type='table'`)
        : { rows: [] };

    logger.debug({ tables }, `Applying patches for...`);

    statements.push(...getPagesToCopy(tables as InternalTable[]));
    statements.push(...getTitlesToCopy(tables as InternalTable[]));

    statements.push(detachDB(ASL_DB_ALIAS));

    if (patchDB) {
        statements.push(detachDB(PATCH_DB_ALIAS));
    }

    return db.executeMultiple(statements.join(';'));
};
