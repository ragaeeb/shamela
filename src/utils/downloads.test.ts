import { describe, expect, it } from 'bun:test';

import { findSqliteEntry, fixHttpsProtocol, getExtension, isSqliteEntry } from './downloads';
import type { UnzippedEntry } from './io';

describe('downloads utilities', () => {
    it('fixHttpsProtocol forces https while preserving host and path', () => {
        const updated = fixHttpsProtocol('http://files.example.com/book.sqlite.zip');
        expect(updated).toBe('https://files.example.com/book.sqlite.zip');
    });

    it('isSqliteEntry identifies supported sqlite extensions case-insensitively', () => {
        const entry: UnzippedEntry = { data: new Uint8Array(), name: 'archive.DB' };
        expect(isSqliteEntry(entry)).toBeTrue();
        expect(isSqliteEntry({ ...entry, name: 'notes.txt' })).toBeFalse();
    });

    it('findSqliteEntry returns the first sqlite entry when available', () => {
        const entries: UnzippedEntry[] = [
            { data: new Uint8Array(), name: 'README.md' },
            { data: new Uint8Array([1, 2]), name: 'content.sqlite' },
            { data: new Uint8Array([3, 4]), name: 'copy.db' },
        ];

        const result = findSqliteEntry(entries);
        expect(result?.name).toBe('content.sqlite');
    });

    it('findSqliteEntry returns undefined when no sqlite entries exist', () => {
        const entries: UnzippedEntry[] = [
            { data: new Uint8Array(), name: 'README.md' },
            { data: new Uint8Array([1]), name: 'book.txt' },
        ];

        const result = findSqliteEntry(entries);
        expect(result).toBeUndefined();
    });

    it('getExtension returns the lowercase extension including the dot', () => {
        expect(getExtension('path/to/book.SQLITE')).toBe('.sqlite');
        expect(getExtension('archive')).toBe('');
    });
});
