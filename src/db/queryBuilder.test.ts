import { describe, expect, it } from 'bun:test';

import { attachDB, createTable, detachDB, insertUnsafely } from './queryBuilder';

describe('queryBuilder', () => {
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

    describe('insertUnsafely', () => {
        it('should generate correct SQL for inserting records when isDeleted is false', () => {
            const table = 'users';
            const fieldToValue = { email: 'alice@example.com', id: 1, name: 'Alice' };
            const isDeleted = false;
            const expectedSQL =
                "INSERT INTO users (email,id,is_deleted,name) VALUES ('alice@example.com',1,'0','Alice')";
            const sql = insertUnsafely(table, fieldToValue, isDeleted);
            expect(sql).toEqual(expectedSQL);
        });

        it('should generate correct SQL for inserting records when isDeleted is true', () => {
            const table = 'users';
            const fieldToValue = { email: 'bob@example.com', id: 2, name: 'Bob' };
            const isDeleted = true;
            const expectedSQL = "INSERT INTO users (email,id,is_deleted,name) VALUES ('bob@example.com',2,'1','Bob')";
            const sql = insertUnsafely(table, fieldToValue, isDeleted);
            expect(sql).toEqual(expectedSQL);
        });

        it('should handle numeric and string values correctly', () => {
            const table = 'products';
            const fieldToValue = { id: 100, name: 'Widget', price: 19.99 };
            const expectedSQL = "INSERT INTO products (id,is_deleted,name,price) VALUES (100,'0','Widget',19.99)";
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
            const expectedSQL = "INSERT INTO users (id,is_deleted,name) VALUES (3,'0','Charlie')";
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
                "INSERT INTO mixed_types (created_at,id,isActive,is_deleted,name,score) VALUES (NULL,1,true,'0','Test',99.5)";
            const sql = insertUnsafely(table, fieldToValue);
            expect(sql).toEqual(expectedSQL);
        });
    });
});
