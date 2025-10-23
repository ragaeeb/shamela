import { afterAll, afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { configure, getConfig, getConfigValue, requireConfigValue, resetConfig } from './config';
import { getLogger } from './utils/logger';

const originalEnv = {
    apiKey: process.env.SHAMELA_API_KEY,
    booksEndpoint: process.env.SHAMELA_API_BOOKS_ENDPOINT,
    masterPatchEndpoint: process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT,
    wasm: process.env.SHAMELA_SQLJS_WASM_URL,
};

describe('configuration helpers', () => {
    const noopLogger = { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } as const;

    beforeEach(() => {
        resetConfig();
        delete process.env.SHAMELA_API_KEY;
        delete process.env.SHAMELA_API_BOOKS_ENDPOINT;
        delete process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT;
        delete process.env.SHAMELA_SQLJS_WASM_URL;
    });

    afterEach(() => {
        resetConfig();
    });

    afterAll(() => {
        process.env.SHAMELA_API_KEY = originalEnv.apiKey;
        process.env.SHAMELA_API_BOOKS_ENDPOINT = originalEnv.booksEndpoint;
        process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = originalEnv.masterPatchEndpoint;
        process.env.SHAMELA_SQLJS_WASM_URL = originalEnv.wasm;
        resetConfig();
    });

    it('prefers runtime configuration over environment variables', () => {
        process.env.SHAMELA_API_KEY = 'env-key';
        configure({ apiKey: 'runtime-key' });

        expect(getConfigValue('apiKey')).toBe('runtime-key');
    });

    it('merges successive configure calls', () => {
        configure({ apiKey: 'initial', booksEndpoint: 'https://example.com/books' });
        configure({ masterPatchEndpoint: 'https://example.com/master' });

        expect(getConfig()).toEqual({
            apiKey: 'initial',
            booksEndpoint: 'https://example.com/books',
            masterPatchEndpoint: 'https://example.com/master',
            sqlJsWasmUrl: undefined,
        });
    });

    it('falls back to environment variables when runtime overrides are absent', () => {
        process.env.SHAMELA_API_KEY = 'env-key';
        expect(getConfigValue('apiKey')).toBe('env-key');
    });

    it('requireConfigValue throws when configuration is missing', () => {
        expect(() => requireConfigValue('apiKey')).toThrow('SHAMELA_API_KEY environment variable not set');
    });

    it('resetConfig clears runtime overrides and restores the default logger', () => {
        const logger = { ...noopLogger, info: () => {} };
        const fakeFetch: typeof fetch = async () => new Response(null);

        configure({ apiKey: 'configured', fetchImplementation: fakeFetch, logger });
        expect(getLogger()).toBe(logger);

        resetConfig();

        expect(getConfigValue('apiKey')).toBeUndefined();
        expect(getLogger()).not.toBe(logger);
        expect(getConfig().fetchImplementation).toBeUndefined();
    });
});
