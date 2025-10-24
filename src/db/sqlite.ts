import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type Statement } from 'sql.js';

import { getConfigValue } from '@/config';
import { findNodeWasmPath } from '@/utils/wasm';

/**
 * Represents a row returned from a SQLite query as a generic key-value object.
 */
export type QueryRow = Record<string, any>;

/**
 * Minimal contract for prepared statements used throughout the project.
 */
export interface PreparedStatement {
    run: (...params: any[]) => void;
    finalize: () => void;
}

/**
 * Interface describing reusable query helpers that return all rows or a single row.
 */
export interface Query {
    all: (...params: any[]) => QueryRow[];
    get: (...params: any[]) => QueryRow | undefined;
}

/**
 * Abstraction over the subset of SQLite database operations required by the library.
 */
export interface SqliteDatabase {
    run: (sql: string, params?: any[]) => void;
    prepare: (sql: string) => PreparedStatement;
    query: (sql: string) => Query;
    transaction: (fn: () => void) => () => void;
    close: () => void;
    export: () => Uint8Array;
}

/**
 * Adapter implementing {@link PreparedStatement} by delegating to a sql.js {@link Statement}.
 */
class SqlJsPreparedStatement implements PreparedStatement {
    constructor(private readonly statement: Statement) {}

    run = (...params: any[]) => {
        if (params.length > 0) {
            this.statement.bind(params);
        }

        this.statement.step();
        this.statement.reset();
    };

    finalize = () => {
        this.statement.free();
    };
}

/**
 * Wrapper providing the {@link SqliteDatabase} interface on top of a sql.js database instance.
 */
class SqlJsDatabaseWrapper implements SqliteDatabase {
    constructor(private readonly db: SqlJsDatabase) {}

    run = (sql: string, params: any[] = []) => {
        this.db.run(sql, params);
    };

    prepare = (sql: string): PreparedStatement => {
        return new SqlJsPreparedStatement(this.db.prepare(sql));
    };

    query = (sql: string): Query => {
        return {
            all: (...params: any[]) => this.all(sql, params),
            get: (...params: any[]) => this.get(sql, params),
        };
    };

    transaction = (fn: () => void) => {
        return () => {
            this.db.run('BEGIN TRANSACTION');
            try {
                fn();
                this.db.run('COMMIT');
            } catch (error) {
                this.db.run('ROLLBACK');
                throw error;
            }
        };
    };

    close = () => {
        this.db.close();
    };

    export = () => {
        return this.db.export();
    };

    private all = (sql: string, params: any[]): QueryRow[] => {
        const statement = this.db.prepare(sql);
        try {
            if (params.length > 0) {
                statement.bind(params);
            }

            const rows: QueryRow[] = [];
            while (statement.step()) {
                rows.push(statement.getAsObject());
            }
            return rows;
        } finally {
            statement.free();
        }
    };

    private get = (sql: string, params: any[]): QueryRow | undefined => {
        const rows = this.all(sql, params);
        return rows[0];
    };
}

let sqlPromise: Promise<SqlJsStatic> | null = null;
let resolvedWasmPath: string | null = null;

const isNodeEnvironment = typeof process !== 'undefined' && Boolean(process?.versions?.node);
const DEFAULT_BROWSER_WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm';

/**
 * Resolves the appropriate location of the sql.js WebAssembly binary.
 *
 * @returns The resolved path or remote URL for the sql.js wasm asset
 */
const getWasmPath = () => {
    if (!resolvedWasmPath) {
        // First priority: user configuration
        const configured = getConfigValue('sqlJsWasmUrl');
        if (configured) {
            resolvedWasmPath = configured;
        } else if (isNodeEnvironment) {
            // Second priority: auto-detect in Node.js
            const nodePath = findNodeWasmPath();
            if (nodePath) {
                resolvedWasmPath = nodePath;
            } else {
                // Fallback: provide helpful error with suggestions
                const errorMsg = [
                    'Unable to automatically locate sql-wasm.wasm file.',
                    'This can happen in bundled environments (Next.js, webpack, etc.).',
                    '',
                    'Quick fix - add this to your code before using shamela:',
                    '',
                    '  import { configure, createNodeConfig } from "shamela";',
                    '  configure(createNodeConfig({',
                    '    apiKey: process.env.SHAMELA_API_KEY,',
                    '    booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,',
                    '    masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,',
                    '  }));',
                    '',
                    'Or manually specify the path:',
                    '',
                    '  import { configure } from "shamela";',
                    '  import { join } from "node:path";',
                    '  configure({',
                    '    sqlJsWasmUrl: join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm")',
                    '  });',
                ].join('\n');

                throw new Error(errorMsg);
            }
        } else {
            // Browser environment: use CDN
            resolvedWasmPath = DEFAULT_BROWSER_WASM_URL;
        }
    }

    return resolvedWasmPath;
};

/**
 * Lazily initialises the sql.js runtime, reusing the same promise for subsequent calls.
 *
 * @returns A promise resolving to the sql.js module
 */
const loadSql = () => {
    if (!sqlPromise) {
        sqlPromise = initSqlJs({
            locateFile: () => getWasmPath(),
        });
    }

    return sqlPromise;
};

/**
 * Creates a new in-memory SQLite database instance backed by sql.js.
 *
 * @returns A promise resolving to a {@link SqliteDatabase} wrapper
 */
export const createDatabase = async () => {
    const SQL = await loadSql();
    return new SqlJsDatabaseWrapper(new SQL.Database());
};

/**
 * Opens an existing SQLite database from the provided binary contents.
 *
 * @param data - The Uint8Array containing the SQLite database bytes
 * @returns A promise resolving to a {@link SqliteDatabase} wrapper
 */
export const openDatabase = async (data: Uint8Array) => {
    const SQL = await loadSql();
    return new SqlJsDatabaseWrapper(new SQL.Database(data));
};
