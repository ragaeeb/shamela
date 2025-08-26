/**
 * Tests for src/utils/validation.ts
 *
 * Framework/Library: Jest (preferred) or Vitest-compatible describe/it/expect usage.
 *
 * This suite validates:
 * - validateEnvVariables: throws for each missing required env var; passes when all present; treats empty string as missing.
 * - validateMasterSourceTables: returns true only when all required base filenames are present; handles order, extras, duplicates, case sensitivity, and empty inputs.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as path from 'node:path';

// Import the functions under test from the sibling module.
import { validateEnvVariables, validateMasterSourceTables } from './validation';

describe('validateEnvVariables', () => {
  const REQUIRED_KEYS = [
    'SHAMELA_API_MASTER_PATCH_ENDPOINT',
    'SHAMELA_API_BOOKS_ENDPOINT',
    'SHAMELA_API_KEY',
  ] as const;

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Clone a clean copy of the current env
    originalEnv = { ...process.env };
    // Clear targeted keys to start fresh
    for (const key of REQUIRED_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore the original env to avoid test cross-contamination
    process.env = originalEnv;
  });

  it('does not throw when all required environment variables are defined with non-empty values', () => {
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = 'https://api.example.com/master-patch';
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'https://api.example.com/books';
    process.env.SHAMELA_API_KEY = 'abc123';

    expect(() => validateEnvVariables()).not.toThrow();
  });

  it('treats empty string values as missing and throws for that key', () => {
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = '';
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'https://api.example.com/books';
    process.env.SHAMELA_API_KEY = 'abc123';

    expect(() => validateEnvVariables()).toThrow(
      'SHAMELA_API_MASTER_PATCH_ENDPOINT environment variable not set'
    );
  });

  it('accepts "0" and "false" (string) as present (truthy strings)', () => {
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = '0';
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'false';
    process.env.SHAMELA_API_KEY = '1';

    expect(() => validateEnvVariables()).not.toThrow();
  });

  it('throws specific error when SHAMELA_API_MASTER_PATCH_ENDPOINT is missing', () => {
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'https://api.example.com/books';
    process.env.SHAMELA_API_KEY = 'abc123';

    expect(() => validateEnvVariables()).toThrow(
      'SHAMELA_API_MASTER_PATCH_ENDPOINT environment variable not set'
    );
  });

  it('throws specific error when SHAMELA_API_BOOKS_ENDPOINT is missing', () => {
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = 'https://api.example.com/master-patch';
    process.env.SHAMELA_API_KEY = 'abc123';

    expect(() => validateEnvVariables()).toThrow(
      'SHAMELA_API_BOOKS_ENDPOINT environment variable not set'
    );
  });

  it('throws specific error when SHAMELA_API_KEY is missing', () => {
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = 'https://api.example.com/master-patch';
    process.env.SHAMELA_API_BOOKS_ENDPOINT = 'https://api.example.com/books';

    expect(() => validateEnvVariables()).toThrow(
      'SHAMELA_API_KEY environment variable not set'
    );
  });

  it('throws referencing the first missing key when multiple are missing', () => {
    // None set -> should report the first missing in the ordered list
    expect(() => validateEnvVariables()).toThrow(
      'SHAMELA_API_MASTER_PATCH_ENDPOINT environment variable not set'
    );
  });
});

describe('validateMasterSourceTables', () => {
  // Required by implementation in src/utils/validation.ts:
  // const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

  it('returns true when all required base filenames are present (order-agnostic)', () => {
    const inputs = [
      '/data/sources/category.sqlite',
      '/mount/anything/book.sqlite',
      '/tmp/author.sqlite',
    ];
    expect(validateMasterSourceTables(inputs)).toBe(true);
  });

  it('returns true when only the basenames are passed without directories', () => {
    const inputs = ['author.sqlite', 'book.sqlite', 'category.sqlite'];
    expect(validateMasterSourceTables(inputs)).toBe(true);
  });

  it('returns false when one required file is missing', () => {
    const inputs = ['/data/author.sqlite', '/data/book.sqlite'];
    expect(validateMasterSourceTables(inputs)).toBe(false);
  });

  it('returns false for empty input array', () => {
    expect(validateMasterSourceTables([])).toBe(false);
  });

  it('returns false when duplicates exist but a required file is still missing', () => {
    const inputs = ['/a/author.sqlite', '/b/author.sqlite', '/c/book.sqlite'];
    expect(validateMasterSourceTables(inputs)).toBe(false);
  });

  it('ignores extra unrelated files and still returns true if all required are present', () => {
    const inputs = [
      '/x/author.sqlite',
      '/y/book.sqlite',
      '/z/category.sqlite',
      '/extras/ignore-me.sqlite',
      '/extras/another.db',
    ];
    expect(validateMasterSourceTables(inputs)).toBe(true);
  });

  it('is case-sensitive and returns false when names differ by case', () => {
    const inputs = [
      '/x/Author.sqlite', // wrong case
      '/y/BOOK.sqlite',   // wrong case
      '/z/category.sqlite',
    ];
    expect(validateMasterSourceTables(inputs)).toBe(false);
  });

  it('handles mixed directory depths and POSIX-style paths', () => {
    const inputs = [
      '/deep/nested/dir/author.sqlite',
      '/another/deep/path/book.sqlite',
      '/top/category.sqlite',
    ];
    expect(validateMasterSourceTables(inputs)).toBe(true);
  });

  it('does not attempt to normalize Windows-style paths using POSIX parser and thus typically returns false if backslashes are used in basenames', () => {
    // This documents the current behavior: path.parse is platform-specific.
    // On non-Windows platforms, "C:\\dir\\author.sqlite" will likely be treated as a single basename.
    // Because of that, unless all three entries share the same backslash style, includes() will not find the required names.
    const inputs = [
      'C:\\dir\\author.sqlite',
      'C:\\dir\\book.sqlite',
      'C:\\dir\\category.sqlite',
    ];
    // For portability of the test, we assert that feeding Windows-style paths is not the intended usage and yields
    // true ONLY if the platform path.parse() treats each base as expected. We'll compute expected via path parsing.
    const parsedBases = inputs.map(p => path.parse(p).base);
    const expected =
      parsedBases.includes('author.sqlite') &&
      parsedBases.includes('book.sqlite') &&
      parsedBases.includes('category.sqlite');

    expect(validateMasterSourceTables(inputs)).toBe(expected);
  });
});