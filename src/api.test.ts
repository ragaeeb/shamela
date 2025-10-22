import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const httpsGetMock = mock(async () => ({}));
const unzipFromUrlMock = mock(async () => []);
const writeOutputMock = mock(async () => {});
const createDatabaseMock = mock(async () => {
    const close = mock(() => {});
    const exportFn = mock(() => new Uint8Array([1]));
    const db = { close, export: exportFn } as const;
    createdDatabases.push({ close, export: exportFn, instance: db });
    return db;
});
const openDatabaseMock = mock(async () => ({ close: mock(() => {}), export: mock(() => new Uint8Array([1])) }));
const createMasterTablesMock = mock(() => {});
const copyForeignMasterTableDataMock = mock(async () => {});
const getMasterDataMock = mock((_: unknown, version: number) => ({
    authors: [{ id: 1 }],
    books: [{ id: 2 }],
    categories: [{ id: 3 }],
    version,
}));
const validateEnvVariablesMock = mock(() => {});
const validateMasterSourceTablesMock = mock(() => true);

const createdDatabases: Array<{
    close: ReturnType<typeof mock>;
    export: ReturnType<typeof mock>;
    instance: { close: ReturnType<typeof mock>; export: ReturnType<typeof mock> };
}> = [];

mock.module('./utils/network.js', () => {
    const buildUrl = (endpoint: string, queryParams: Record<string, any>, useAuth: boolean = true): URL => {
        const url = new URL(endpoint);
        const params = new URLSearchParams();

        Object.entries(queryParams).forEach(([key, value]) => {
            params.append(key, value.toString());
        });

        if (useAuth) {
            params.append('api_key', process.env.SHAMELA_API_KEY ?? '');
        }

        url.search = params.toString();
        return url;
    };

    return { buildUrl, httpsGet: httpsGetMock };
});

mock.module('./utils/io.js', () => ({
    unzipFromUrl: unzipFromUrlMock,
    writeOutput: writeOutputMock,
}));

mock.module('./db/master.js', () => ({
    copyForeignMasterTableData: copyForeignMasterTableDataMock,
    createTables: createMasterTablesMock,
    getData: getMasterDataMock,
}));

mock.module('./utils/validation.js', () => ({
    validateEnvVariables: validateEnvVariablesMock,
    validateMasterSourceTables: validateMasterSourceTablesMock,
}));

mock.module('./db/sqlite.js', () => ({
    createDatabase: createDatabaseMock,
    openDatabase: openDatabaseMock,
}));

mock.module('./db/book.js', () => ({
    applyPatches: mock(() => {}),
    copyTableData: mock(() => {}),
    createTables: mock(() => {}),
    getData: mock(async () => ({ pages: [], titles: [] })),
}));

const { downloadMasterDatabase, getBookMetadata, getMaster } = await import('./api');

const originalEnv = {
    SHAMELA_API_KEY: process.env.SHAMELA_API_KEY,
    SHAMELA_API_BOOKS_ENDPOINT: process.env.SHAMELA_API_BOOKS_ENDPOINT,
    SHAMELA_API_MASTER_PATCH_ENDPOINT: process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT,
};

beforeEach(() => {
    process.env.SHAMELA_API_KEY = 'test-api-key';
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'https://example.com/books';
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = 'https://example.com/master';

    httpsGetMock.mockReset();
    unzipFromUrlMock.mockReset();
    writeOutputMock.mockReset();
    createDatabaseMock.mockReset();
    openDatabaseMock.mockReset();
    createMasterTablesMock.mockReset();
    copyForeignMasterTableDataMock.mockReset();
    getMasterDataMock.mockReset();
    validateEnvVariablesMock.mockReset();
    validateMasterSourceTablesMock.mockReset();
    createdDatabases.length = 0;

    httpsGetMock.mockImplementation(async () => ({}));
    unzipFromUrlMock.mockImplementation(async () => []);
    writeOutputMock.mockImplementation(async () => {});
    createDatabaseMock.mockImplementation(async () => {
        const close = mock(() => {});
        const exportFn = mock(() => new Uint8Array([1]));
        const db = { close, export: exportFn } as const;
        createdDatabases.push({ close, export: exportFn, instance: db });
        return db;
    });
    openDatabaseMock.mockImplementation(async () => ({ close: mock(() => {}), export: mock(() => new Uint8Array([1])) }));
    createMasterTablesMock.mockImplementation(() => {});
    copyForeignMasterTableDataMock.mockImplementation(async () => {});
    getMasterDataMock.mockImplementation((_, version: number) => ({
        authors: [{ id: 1 }],
        books: [{ id: 2 }],
        categories: [{ id: 3 }],
        version,
    }));
    validateEnvVariablesMock.mockImplementation(() => {});
    validateMasterSourceTablesMock.mockImplementation(() => true);
});

afterEach(() => {
    delete process.env.SHAMELA_SQLJS_WASM_URL;
});

afterAll(() => {
    if (originalEnv.SHAMELA_API_KEY === undefined) {
        delete process.env.SHAMELA_API_KEY;
    } else {
        process.env.SHAMELA_API_KEY = originalEnv.SHAMELA_API_KEY;
    }

    if (originalEnv.SHAMELA_API_BOOKS_ENDPOINT === undefined) {
        delete process.env.SHAMELA_API_BOOKS_ENDPOINT;
    } else {
        process.env.SHAMELA_API_BOOKS_ENDPOINT = originalEnv.SHAMELA_API_BOOKS_ENDPOINT;
    }

    if (originalEnv.SHAMELA_API_MASTER_PATCH_ENDPOINT === undefined) {
        delete process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT;
    } else {
        process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = originalEnv.SHAMELA_API_MASTER_PATCH_ENDPOINT;
    }

    mock.restore();
});

const asUrlString = (value: unknown) => {
    if (value instanceof URL) {
        return value.toString();
    }

    if (typeof value === 'string') {
        return value;
    }

    throw new Error('Expected URL or string');
};

describe('api helpers', () => {
    it('getBookMetadata builds the request url and normalises release urls', async () => {
        httpsGetMock.mockResolvedValueOnce({
            major_release: 3,
            major_release_url: 'http://downloads.example.com/book.sqlite.zip',
            minor_release: 1,
            minor_release_url: 'http://downloads.example.com/book.patch.zip',
        });

        const result = await getBookMetadata(123, { majorVersion: 9, minorVersion: 5 });

        expect(httpsGetMock).toHaveBeenCalledTimes(1);
        expect(validateEnvVariablesMock).toHaveBeenCalledTimes(1);

        const request = asUrlString(httpsGetMock.mock.calls[0][0]);
        expect(request).toBe('https://example.com/books/123?major_release=9&minor_release=5&api_key=test-api-key');

        expect(result).toEqual({
            majorRelease: 3,
            majorReleaseUrl: 'https://downloads.example.com/book.sqlite.zip',
            minorRelease: 1,
            minorReleaseUrl: 'https://downloads.example.com/book.patch.zip',
        });
    });

    it('downloadMasterDatabase writes json output including version metadata', async () => {
        const sqliteEntry = { data: new Uint8Array([1, 2, 3]), name: 'author.sqlite' };
        const ignoredEntry = { data: new Uint8Array([4]), name: 'notes.txt' };

        unzipFromUrlMock.mockResolvedValueOnce([sqliteEntry, ignoredEntry]);

        const outputChunks: any[] = [];
        writeOutputMock.mockImplementation(async (_options, payload) => {
            outputChunks.push(payload);
        });

        await downloadMasterDatabase({
            masterMetadata: { url: 'http://files.example.com/master.zip', version: 42 },
            outputFile: { path: '/tmp/master.json' },
        });

        expect(unzipFromUrlMock).toHaveBeenCalledWith('https://files.example.com/master.zip');
        expect(validateMasterSourceTablesMock).toHaveBeenCalledWith(['author.sqlite', 'notes.txt']);
        expect(copyForeignMasterTableDataMock).toHaveBeenCalledTimes(1);
        expect(copyForeignMasterTableDataMock.mock.calls[0][1]).toEqual([sqliteEntry]);
        expect(getMasterDataMock).toHaveBeenCalledWith(expect.any(Object), 42);
        expect(writeOutputMock).toHaveBeenCalledTimes(1);

        const payload = outputChunks[0];
        expect(typeof payload).toBe('string');
        const parsed = JSON.parse(payload as string);
        expect(parsed).toEqual({
            authors: [{ id: 1 }],
            books: [{ id: 2 }],
            categories: [{ id: 3 }],
            version: 42,
        });

        expect(createdDatabases).toHaveLength(1);
        expect(createdDatabases[0].close).toHaveBeenCalledTimes(1);
    });

    it('getMaster fetches metadata and returns in-memory master data', async () => {
        httpsGetMock.mockResolvedValueOnce({
            patch_url: 'http://files.example.com/master.zip',
            version: 7,
        });

        const sqliteEntry = { data: new Uint8Array([1, 2, 3]), name: 'book.sqlite' };
        unzipFromUrlMock.mockResolvedValueOnce([sqliteEntry]);

        const result = await getMaster();

        expect(httpsGetMock).toHaveBeenCalledTimes(1);
        const request = asUrlString(httpsGetMock.mock.calls[0][0]);
        expect(request).toBe('https://example.com/master?version=0&api_key=test-api-key');
        expect(validateEnvVariablesMock).toHaveBeenCalledTimes(1);
        expect(unzipFromUrlMock).toHaveBeenCalledWith('https://files.example.com/master.zip');
        expect(validateMasterSourceTablesMock).toHaveBeenCalledWith(['book.sqlite']);
        expect(copyForeignMasterTableDataMock.mock.calls[0][1]).toEqual([sqliteEntry]);
        expect(result).toEqual({
            authors: [{ id: 1 }],
            books: [{ id: 2 }],
            categories: [{ id: 3 }],
            version: 7,
        });
        expect(writeOutputMock).not.toHaveBeenCalled();
        expect(createdDatabases[0].close).toHaveBeenCalledTimes(1);
    });
});
