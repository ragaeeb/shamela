import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { zipSync } from 'fflate';

import { configure, resetConfig } from './config';
import { downloadMasterDatabase, getBookMetadata, getMaster } from './api';
import { createDatabase } from './db/sqlite';
import { Tables } from './db/types';
import { createTables as createMasterTables } from './db/master';
import type { MasterData } from './types';

const originalFetch = globalThis.fetch;
const originalEnv = {
    apiKey: process.env.SHAMELA_API_KEY,
    booksEndpoint: process.env.SHAMELA_API_BOOKS_ENDPOINT,
    masterEndpoint: process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT,
};

const buildMasterArchive = async () => {
    const db = await createDatabase();
    try {
        createMasterTables(db);

        db.run(
            `INSERT INTO ${Tables.Authors} (id, is_deleted, name, biography, death_text, death_number) VALUES (1, '0', 'Author', 'Bio', 'Text', '123')`,
        );
        db.run(
            `INSERT INTO ${Tables.Books} (id, name, is_deleted, category, type, date, author, printed, minor_release, major_release, bibliography, hint, pdf_links, metadata) VALUES (2, 'Book', '0', '1', 'type', '1440', '1', '1', '0', '0', 'Notes', 'Hint', NULL, '{}')`,
        );
        db.run(`INSERT INTO ${Tables.Categories} (id, is_deleted, "order", name) VALUES (3, '0', '1', 'Category')`);

        const bytes = db.export();
        return zipSync({
            'author.sqlite': bytes,
            'book.sqlite': bytes,
            'category.sqlite': bytes,
            'notes.txt': new TextEncoder().encode('ignore me'),
        });
    } finally {
        db.close();
    }
};

describe('api helpers', () => {
    const fetchMock = mock<typeof fetch>(async () => new Response(null));

    beforeAll(() => {
        globalThis.fetch = fetchMock as typeof fetch;
    });

    beforeEach(() => {
        configure({
            apiKey: 'test-api-key',
            booksEndpoint: 'https://example.com/books',
            masterPatchEndpoint: 'https://example.com/master',
        });
        fetchMock.mockReset();
        delete process.env.SHAMELA_SQLJS_WASM_URL;
    });

    afterEach(() => {
        resetConfig();
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
        process.env.SHAMELA_API_KEY = originalEnv.apiKey;
        process.env.SHAMELA_API_BOOKS_ENDPOINT = originalEnv.booksEndpoint;
        process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = originalEnv.masterEndpoint;
        resetConfig();
    });

    it('getBookMetadata builds the request url and normalises release urls', async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    major_release: 3,
                    major_release_url: 'http://downloads.example.com/book.sqlite.zip',
                    minor_release: 1,
                    minor_release_url: 'http://downloads.example.com/book.patch.zip',
                }),
                { headers: { 'content-type': 'application/json' } },
            ),
        );

        const result = await getBookMetadata(123, { majorVersion: 9, minorVersion: 5 });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const requestUrl = fetchMock.mock.calls[0][0] as string;
        const request = new URL(requestUrl);
        expect(request.toString()).toBe(
            'https://example.com/books/123?major_release=9&minor_release=5&api_key=test-api-key',
        );

        expect(result).toEqual({
            majorRelease: 3,
            majorReleaseUrl: 'https://downloads.example.com/book.sqlite.zip',
            minorRelease: 1,
            minorReleaseUrl: 'https://downloads.example.com/book.patch.zip',
        });
    });

    it('downloadMasterDatabase writes json output including version metadata', async () => {
        const archive = await buildMasterArchive();
        fetchMock.mockResolvedValueOnce(
            new Response(archive, { headers: { 'content-type': 'application/octet-stream' } }),
        );

        const chunks: string[] = [];
        await downloadMasterDatabase({
            masterMetadata: { url: 'http://files.example.com/master.zip', version: 42 },
            outputFile: {
                path: '/tmp/master.json',
                writer: (payload) =>
                    chunks.push(typeof payload === 'string' ? payload : new TextDecoder().decode(payload)),
            },
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const written = JSON.parse(chunks[0]) as MasterData;
        expect(written.version).toBe(42);
        expect(written.authors).toHaveLength(1);
        expect(written.books).toHaveLength(1);
        expect(written.categories).toHaveLength(1);
    });

    it('getMaster fetches metadata and returns in-memory master data', async () => {
        const archive = await buildMasterArchive();
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ patch_url: 'http://files.example.com/master.zip', version: 7 }), {
                headers: { 'content-type': 'application/json' },
            }),
        );
        fetchMock.mockResolvedValueOnce(
            new Response(archive, { headers: { 'content-type': 'application/octet-stream' } }),
        );

        const result = await getMaster();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.version).toBe(7);
        expect(result.authors).toHaveLength(1);
        expect(result.books).toHaveLength(1);
        expect(result.categories).toHaveLength(1);
        expect(result.authors[0].name).toBe('Author');
    });
});
