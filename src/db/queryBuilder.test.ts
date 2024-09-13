import { describe, expect, it } from 'vitest';

import {
    attachDB,
    buildPagePatchQuery,
    buildTitlePatchQuery,
    createTable,
    detachDB,
    insertUnsafely,
} from './queryBuilder';

describe('queryBuilder', () => {
    const removeWhitespace = (str) => str.replace(/\s+/g, '');

    describe('createTable', () => {
        it('should generate correct SQL for table creation with multiple fields', () => {
            const tableName = 'users';
            const fields = ['id INTEGER PRIMARY KEY', 'name TEXT', 'email TEXT'];
            const sql = createTable(tableName, fields);
            expect(sql).toEqual('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
        });

        it('should generate correct SQL for table creation with single field', () => {
            const tableName = 'settings';
            const fields = ['key TEXT PRIMARY KEY'];
            const expectedSQL = 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY)';
            const sql = createTable(tableName, fields);
            expect(sql).toEqual(expectedSQL);
        });
    });

    describe('attachDB', () => {
        it('should generate correct SQL to attach a database', () => {
            const dbFile = '/path/to/database.db';
            const alias = 'externalDB';
            const sql = attachDB(dbFile, alias);
            expect(sql).toEqual("ATTACH DATABASE '/path/to/database.db' AS externalDB");
        });
    });

    describe('detachDB', () => {
        it('should generate correct SQL to detach a database', () => {
            const alias = 'externalDB';
            const expectedSQL = 'DETACH DATABASE externalDB';
            const sql = detachDB(alias);
            expect(sql).toEqual(expectedSQL);
        });
    });

    describe('buildPagePatchQuery', () => {
        it('should generate correct SQL for page patching with custom aliases', () => {
            const patchAlias = 'patchDB';
            const tableName = 'page';
            const aslAlias = 'mainDB';
            const expectedSQL = `
      UPDATE mainDB.page
      SET content = 
      (SELECT CASE 
                 WHEN patchDB.page.content != '#' THEN patchDB.page.content
                 ELSE mainDB.page.content
               END 
        FROM patchDB.page
        WHERE mainDB.page.id = patchDB.page.id),
          part = 
      (SELECT CASE 
                 WHEN patchDB.page.part != '#' THEN patchDB.page.part
                 ELSE mainDB.page.part
               END 
        FROM patchDB.page
        WHERE mainDB.page.id = patchDB.page.id),
          page = 
      (SELECT CASE 
                 WHEN patchDB.page.page != '#' THEN patchDB.page.page
                 ELSE mainDB.page.page
               END 
        FROM patchDB.page
        WHERE mainDB.page.id = patchDB.page.id),
          number = 
      (SELECT CASE 
                 WHEN patchDB.page.number != '#' THEN patchDB.page.number
                 ELSE mainDB.page.number
               END 
        FROM patchDB.page
        WHERE mainDB.page.id = patchDB.page.id)
      WHERE EXISTS (
        SELECT 1
        FROM patchDB.page
        WHERE mainDB.page.id = patchDB.page.id
      );
    `;
            const sql = removeWhitespace(buildPagePatchQuery(patchAlias, tableName, aslAlias));
            expect(sql.trim()).toEqual(removeWhitespace(expectedSQL));
        });

        it('should generate correct SQL for page patching with default alias', () => {
            const patchAlias = 'patchDB';
            const tableName = 'page';
            const expectedSQL = `
      UPDATE main.page
      SET content = 
      (SELECT CASE 
                 WHEN patchDB.page.content != '#' THEN patchDB.page.content
                 ELSE main.page.content
               END 
        FROM patchDB.page
        WHERE main.page.id = patchDB.page.id),
          part = 
      (SELECT CASE 
                 WHEN patchDB.page.part != '#' THEN patchDB.page.part
                 ELSE main.page.part
               END 
        FROM patchDB.page
        WHERE main.page.id = patchDB.page.id),
          page = 
      (SELECT CASE 
                 WHEN patchDB.page.page != '#' THEN patchDB.page.page
                 ELSE main.page.page
               END 
        FROM patchDB.page
        WHERE main.page.id = patchDB.page.id),
          number = 
      (SELECT CASE 
                 WHEN patchDB.page.number != '#' THEN patchDB.page.number
                 ELSE main.page.number
               END 
        FROM patchDB.page
        WHERE main.page.id = patchDB.page.id)
      WHERE EXISTS (
        SELECT 1
        FROM patchDB.page
        WHERE main.page.id = patchDB.page.id
      );
    `;
            const sql = removeWhitespace(buildPagePatchQuery(patchAlias, tableName));
            expect(sql.trim()).toEqual(removeWhitespace(expectedSQL));
        });
    });

    describe('buildTitlePatchQuery', () => {
        it('should generate correct SQL for title patching with custom aliases', () => {
            const patchAlias = 'patchDB';
            const tableName = 'title';
            const aslAlias = 'mainDB';
            const expectedSQL = `
      UPDATE mainDB.title
      SET content = 
      (SELECT CASE 
                 WHEN patchDB.title.content != '#' THEN patchDB.title.content
                 ELSE mainDB.title.content
               END 
        FROM patchDB.title
        WHERE mainDB.title.id = patchDB.title.id),
          page = 
      (SELECT CASE 
                 WHEN patchDB.title.page != '#' THEN patchDB.title.page
                 ELSE mainDB.title.page
               END 
        FROM patchDB.title
        WHERE mainDB.title.id = patchDB.title.id),
          parent = 
      (SELECT CASE 
                 WHEN patchDB.title.parent != '#' THEN patchDB.title.parent
                 ELSE mainDB.title.parent
               END 
        FROM patchDB.title
        WHERE mainDB.title.id = patchDB.title.id)
      WHERE EXISTS (
        SELECT 1
        FROM patchDB.title
        WHERE mainDB.title.id = patchDB.title.id
      );
    `;
            const sql = removeWhitespace(buildTitlePatchQuery(patchAlias, tableName, aslAlias));
            expect(sql.trim()).toEqual(removeWhitespace(expectedSQL.trim()));
        });

        it('should generate correct SQL for title patching with default alias', () => {
            const patchAlias = 'patchDB';
            const tableName = 'title';
            const expectedSQL = `
      UPDATE main.title
      SET content = 
      (SELECT CASE 
                 WHEN patchDB.title.content != '#' THEN patchDB.title.content
                 ELSE main.title.content
               END 
        FROM patchDB.title
        WHERE main.title.id = patchDB.title.id),
          page = 
      (SELECT CASE 
                 WHEN patchDB.title.page != '#' THEN patchDB.title.page
                 ELSE main.title.page
               END 
        FROM patchDB.title
        WHERE main.title.id = patchDB.title.id),
          parent = 
      (SELECT CASE 
                 WHEN patchDB.title.parent != '#' THEN patchDB.title.parent
                 ELSE main.title.parent
               END 
        FROM patchDB.title
        WHERE main.title.id = patchDB.title.id)
      WHERE EXISTS (
        SELECT 1
        FROM patchDB.title
        WHERE main.title.id = patchDB.title.id
      );
    `;
            const sql = removeWhitespace(buildTitlePatchQuery(patchAlias, tableName));
            expect(sql.trim()).toEqual(removeWhitespace(expectedSQL.trim()));
        });
    });

    describe('insertUnsafely', () => {
        it('should generate correct SQL for inserting records when isDeleted is false', () => {
            const table = 'users';
            const fieldToValue = { email: 'alice@example.com', id: 1, name: 'Alice' };
            const isDeleted = false;
            const expectedSQL =
                "INSERT INTO users (id,name,email,is_deleted) VALUES (1,'Alice','alice@example.com','0')";
            const sql = insertUnsafely(table, fieldToValue, isDeleted);
            expect(sql).toEqual(expectedSQL);
        });

        it('should generate correct SQL for inserting records when isDeleted is true', () => {
            const table = 'users';
            const fieldToValue = { email: 'bob@example.com', id: 2, name: 'Bob' };
            const isDeleted = true;
            const expectedSQL = "INSERT INTO users (id,name,email,is_deleted) VALUES (2,'Bob','bob@example.com','1')";
            const sql = insertUnsafely(table, fieldToValue, isDeleted);
            expect(sql).toEqual(expectedSQL);
        });

        it('should handle numeric and string values correctly', () => {
            const table = 'products';
            const fieldToValue = { id: 100, name: 'Widget', price: 19.99 };
            const expectedSQL = "INSERT INTO products (id,name,price,is_deleted) VALUES (100,'Widget',19.99,'0')";
            const sql = insertUnsafely(table, fieldToValue);
            expect(sql).toEqual(expectedSQL);
        });

        it('should handle empty fieldToValue object', () => {
            const table = 'empty_table';
            const fieldToValue = {};
            const expectedSQL = `INSERT INTO empty_table (is_deleted) VALUES ('0')`;
            const sql = insertUnsafely(table, fieldToValue);
            expect(sql).toEqual(expectedSQL);
        });

        it('should handle undefined isDeleted parameter (default to false)', () => {
            const table = 'users';
            const fieldToValue = { id: 3, name: 'Charlie' };
            const expectedSQL = "INSERT INTO users (id,name,is_deleted) VALUES (3,'Charlie','0')";
            const sql = insertUnsafely(table, fieldToValue);
            expect(sql).toEqual(expectedSQL);
        });

        it('should correctly process different data types', () => {
            const table = 'mixed_types';
            const fieldToValue = {
                created_at: null,
                id: 1,
                isActive: true,
                name: 'Test',
                score: 99.5,
            };
            const expectedSQL =
                "INSERT INTO mixed_types (id,name,isActive,created_at,score,is_deleted) VALUES (1,'Test',true,NULL,99.5,'0')";
            const sql = insertUnsafely(table, fieldToValue);
            expect(sql).toEqual(expectedSQL);
        });
    });
});
