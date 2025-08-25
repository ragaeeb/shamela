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
            `INSERT INTO main.${table} 
             SELECT ${fields.join(',')} 
             FROM ${ASL_DB_ALIAS}.${table} 
             WHERE id NOT IN (
                 SELECT id 
                 FROM ${PATCH_DB_ALIAS}.${table} 
                 WHERE is_deleted='1'
             )`,
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

/**
 * Applies patches from a patch database to the main book database.
 *
 * This function handles the process of applying updates and patches to book data
 * by attaching both the original ASL database and patch database, then merging
 * the data while excluding deleted records and applying updates from patches.
 *
 * @param db - The libSQL client instance for the main database
 * @param aslDB - Path to the original ASL database file
 * @param patchDB - Path to the patch database file containing updates
 * @returns A promise that resolves when patches are successfully applied
 *
 * @throws {Error} When database operations fail or tables cannot be attached
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * await applyPatches(client, './original.db', './patch.db');
 * ```
 */
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

/**
 * Copies table data from an ASL database to the main database.
 *
 * This function is used when no patches are available and data needs to be
 * copied directly from the original ASL database to the main database.
 * It handles both page and title data.
 *
 * @param db - The libSQL client instance for the main database
 * @param aslDB - Path to the ASL database file to copy data from
 * @returns A promise that resolves when data copying is complete
 *
 * @throws {Error} When database operations fail or the ASL database cannot be attached
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * await copyTableData(client, './source.db');
 * ```
 */
export const copyTableData = async (db: Client, aslDB: string) => {
    await db.execute(attachDB(aslDB, ASL_DB_ALIAS));
    const tables = await getInternalTables(db, ASL_DB_ALIAS);

    logger.debug({ tables }, `copyTableData...`);

    await db.batch([
        `INSERT INTO main.${Tables.Title} SELECT id,content,page,parent FROM ${ASL_DB_ALIAS}.${Tables.Title}`,
        `INSERT INTO main.${Tables.Page} SELECT id,content,part,page,number FROM ${ASL_DB_ALIAS}.${Tables.Page}`,
    ]);

    return db.execute(detachDB(ASL_DB_ALIAS));
};

/**
 * Creates the necessary database tables for storing book data.
 *
 * This function sets up the schema for the book database by creating
 * the 'page' and 'title' tables with their respective columns and constraints.
 *
 * @param db - The libSQL client instance where tables should be created
 * @returns A promise that resolves when tables are successfully created
 *
 * @throws {Error} When table creation fails due to database constraints or permissions
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * await createTables(client);
 * ```
 */
export const createTables = async (db: Client) => {
    return db.batch([
        `CREATE TABLE page (id INTEGER PRIMARY KEY, content TEXT, part INTEGER, page INTEGER, number INTEGER)`,
        `CREATE TABLE title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER)`,
    ]);
};

/**
 * Retrieves all pages from the book database.
 *
 * This function queries the database for all page records and transforms
 * them into a structured format, filtering out null values and organizing
 * the data according to the Page type interface.
 *
 * @param db - The libSQL client instance to query
 * @returns A promise that resolves to an array of Page objects
 *
 * @throws {Error} When database query fails or data transformation encounters issues
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * const pages = await getAllPages(client);
 * console.log(pages[0].content); // Page content text
 * ```
 */
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

/**
 * Retrieves all titles from the book database.
 *
 * This function queries the database for all title records and transforms
 * them into a structured format. Titles represent the hierarchical structure
 * and table of contents for the book.
 *
 * @param db - The libSQL client instance to query
 * @returns A promise that resolves to an array of Title objects
 *
 * @throws {Error} When database query fails or data transformation encounters issues
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * const titles = await getAllTitles(client);
 * console.log(titles[0].content); // Title text
 * console.log(titles[0].parent); // Parent title ID if applicable
 * ```
 */
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

/**
 * Retrieves complete book data including both pages and titles.
 *
 * This function combines the results from getAllPages and getAllTitles
 * to provide a complete representation of the book's content and structure.
 * This is typically the final step in processing book data.
 *
 * @param db - The libSQL client instance to query
 * @returns A promise that resolves to complete BookData containing pages and titles
 *
 * @throws {Error} When database queries fail or data processing encounters issues
 *
 * @example
 * ```typescript
 * const client = createClient({ url: 'file:./book.db' });
 * const bookData = await getData(client);
 * console.log(bookData.pages.length); // Number of pages
 * console.log(bookData.titles?.length); // Number of titles
 * ```
 */
export const getData = async (db: Client): Promise<BookData> => {
    const [pages, titles] = await Promise.all([getAllPages(db), getAllTitles(db)]);
    return { pages, titles };
};
