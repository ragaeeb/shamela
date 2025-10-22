import { afterAll, afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { configure, resetConfig } from '../config';
import { validateEnvVariables, validateMasterSourceTables } from './validation';

const originalEnv = {
    apiKey: process.env.SHAMELA_API_KEY,
    booksEndpoint: process.env.SHAMELA_API_BOOKS_ENDPOINT,
    masterEndpoint: process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT,
};

describe('validation utilities', () => {
    beforeEach(() => {
        resetConfig();
        delete process.env.SHAMELA_API_KEY;
        delete process.env.SHAMELA_API_BOOKS_ENDPOINT;
        delete process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT;
    });

    afterEach(() => {
        resetConfig();
    });

    afterAll(() => {
        process.env.SHAMELA_API_KEY = originalEnv.apiKey;
        process.env.SHAMELA_API_BOOKS_ENDPOINT = originalEnv.booksEndpoint;
        process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = originalEnv.masterEndpoint;
        resetConfig();
    });

    it('validateEnvVariables throws when required configuration is missing', () => {
        expect(() => validateEnvVariables()).toThrow(
            'SHAMELA_API_KEY, SHAMELA_API_BOOKS_ENDPOINT, SHAMELA_API_MASTER_PATCH_ENDPOINT environment variables not set',
        );
    });

    it('validateEnvVariables passes when configuration is provided', () => {
        configure({
            apiKey: 'key',
            booksEndpoint: 'https://example.com/books',
            masterPatchEndpoint: 'https://example.com/master',
        });

        expect(() => validateEnvVariables()).not.toThrow();
    });

    it('validateMasterSourceTables checks for all required master tables', () => {
        const paths = ['Author.sqlite', 'folder/book.sqlite', 'CATEGORY.SQLITE'];
        expect(validateMasterSourceTables(paths)).toBeTrue();
    });

    it('validateMasterSourceTables returns false when any table is missing', () => {
        const paths = ['author.sqlite', 'book.sqlite'];
        expect(validateMasterSourceTables(paths)).toBeFalse();
    });
});
