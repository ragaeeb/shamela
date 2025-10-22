import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type Statement } from 'sql.js';

import { getConfigValue } from '../config.js';

export type QueryRow = Record<string, any>;

export interface PreparedStatement {
    run: (...params: any[]) => void;
    finalize: () => void;
}

export interface Query {
    all: (...params: any[]) => QueryRow[];
    get: (...params: any[]) => QueryRow | undefined;
}

export interface SqliteDatabase {
    run: (sql: string, params?: any[]) => void;
    prepare: (sql: string) => PreparedStatement;
    query: (sql: string) => Query;
    transaction: (fn: () => void) => () => void;
    close: () => void;
    export: () => Uint8Array;
}

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

const getWasmPath = () => {
    if (!resolvedWasmPath) {
        const configured = getConfigValue('sqlJsWasmUrl');
        if (configured) {
            resolvedWasmPath = configured;
        } else if (isNodeEnvironment) {
            const url = new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url);
            resolvedWasmPath = decodeURIComponent(url.pathname);
        } else {
            resolvedWasmPath = DEFAULT_BROWSER_WASM_URL;
        }
    }

    return resolvedWasmPath;
};

const loadSql = () => {
    if (!sqlPromise) {
        sqlPromise = initSqlJs({
            locateFile: () => getWasmPath(),
        });
    }

    return sqlPromise;
};

export const createDatabase = async () => {
    const SQL = await loadSql();
    return new SqlJsDatabaseWrapper(new SQL.Database());
};

export const openDatabase = async (data: Uint8Array) => {
    const SQL = await loadSql();
    return new SqlJsDatabaseWrapper(new SQL.Database(data));
};
