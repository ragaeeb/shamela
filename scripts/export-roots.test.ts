/**
 * @fileoverview Unit tests for Arabic Root Morphology Export
 *
 * Tests the Windows-1256 decoding and root parsing functions.
 */

import { describe, expect, it } from 'bun:test';
import {
    calculateStats,
    createRootMap,
    decodeWindows1256,
    parseRoots,
    type RootMapping,
    type RootRow,
    transformRootRow,
    WINDOWS_1256_MAP,
} from './export-roots';

describe('WINDOWS_1256_MAP', () => {
    it('should map Arabic letters correctly', () => {
        expect(WINDOWS_1256_MAP[0xc1]).toBe('ء'); // hamza
        expect(WINDOWS_1256_MAP[0xc2]).toBe('آ'); // alif with madda
        expect(WINDOWS_1256_MAP[0xc7]).toBe('ا'); // alif
        expect(WINDOWS_1256_MAP[0xc8]).toBe('ب'); // ba
        expect(WINDOWS_1256_MAP[0xca]).toBe('ت'); // ta
        expect(WINDOWS_1256_MAP[0xcb]).toBe('ث'); // tha
    });

    it('should map common punctuation', () => {
        expect(WINDOWS_1256_MAP[0xa1]).toBe('،'); // Arabic comma
        expect(WINDOWS_1256_MAP[0xbf]).toBe('؟'); // Arabic question mark
        expect(WINDOWS_1256_MAP[0xba]).toBe('؛'); // Arabic semicolon
    });

    it('should map diacritics', () => {
        expect(WINDOWS_1256_MAP[0xf0]).toBe('ً'); // fathatan
        expect(WINDOWS_1256_MAP[0xf1]).toBe('ٌ'); // dammatan
        expect(WINDOWS_1256_MAP[0xf2]).toBe('ٍ'); // kasratan
        expect(WINDOWS_1256_MAP[0xf3]).toBe('َ'); // fatha
        expect(WINDOWS_1256_MAP[0xf5]).toBe('ُ'); // damma
        expect(WINDOWS_1256_MAP[0xf6]).toBe('ِ'); // kasra
        expect(WINDOWS_1256_MAP[0xf8]).toBe('ّ'); // shadda
        expect(WINDOWS_1256_MAP[0xfa]).toBe('ْ'); // sukun
    });

    it('should have coverage for all extended bytes 0x80-0xFF', () => {
        // Verify the map covers the full extended range
        let coveredCount = 0;
        for (let i = 0x80; i <= 0xff; i++) {
            if (WINDOWS_1256_MAP[i] !== undefined) {
                coveredCount++;
            }
        }
        // All 128 extended bytes should be mapped
        expect(coveredCount).toBe(128);
    });
});

describe('decodeWindows1256', () => {
    it('should return empty string for null input', () => {
        expect(decodeWindows1256(null)).toBe('');
    });

    it('should return empty string for empty array', () => {
        expect(decodeWindows1256(new Uint8Array([]))).toBe('');
    });

    it('should decode ASCII characters unchanged', () => {
        // "abc" = 0x61 0x62 0x63
        const encoded = new Uint8Array([0x61, 0x62, 0x63]);
        expect(decodeWindows1256(encoded)).toBe('abc');
    });

    it('should decode Arabic word ءبو (root)', () => {
        // ء ب و = 0xC1 0xC8 0xE6
        const encoded = new Uint8Array([0xc1, 0xc8, 0xe6]);
        expect(decodeWindows1256(encoded)).toBe('ءبو');
    });

    it('should decode Arabic word آباء', () => {
        // آ ب ا ء = 0xC2 0xC8 0xC7 0xC1
        const encoded = new Uint8Array([0xc2, 0xc8, 0xc7, 0xc1]);
        expect(decodeWindows1256(encoded)).toBe('آباء');
    });

    it('should decode mixed ASCII and Arabic', () => {
        // a ب c = 0x61 0xC8 0x63
        const encoded = new Uint8Array([0x61, 0xc8, 0x63]);
        expect(decodeWindows1256(encoded)).toBe('aبc');
    });

    it('should handle comma separator (ASCII)', () => {
        // Root string with comma: ءتي,ءتو
        // ء=0xC1, ت=0xCA, ي=0xED, ,=0x2C
        const encoded = new Uint8Array([0xc1, 0xca, 0xed, 0x2c, 0xc1, 0xca, 0xe6]);
        expect(decodeWindows1256(encoded)).toBe('ءتي,ءتو');
    });
});

describe('parseRoots', () => {
    it('should return empty array for empty string', () => {
        expect(parseRoots('')).toEqual([]);
    });

    it('should return empty array for whitespace only', () => {
        expect(parseRoots('   ')).toEqual([]);
    });

    it('should parse single root', () => {
        expect(parseRoots('ءبو')).toEqual(['ءبو']);
    });

    it('should parse multiple roots separated by comma', () => {
        expect(parseRoots('ءتي,ءتو,ءتت')).toEqual(['ءتي', 'ءتو', 'ءتت']);
    });

    it('should trim whitespace around roots', () => {
        expect(parseRoots(' ءبو , ءتي ')).toEqual(['ءبو', 'ءتي']);
    });

    it('should filter out empty roots from consecutive commas', () => {
        expect(parseRoots('ءبو,,ءتي')).toEqual(['ءبو', 'ءتي']);
    });

    it('should handle trailing comma', () => {
        expect(parseRoots('ءبو,')).toEqual(['ءبو']);
    });

    it('should handle leading comma', () => {
        expect(parseRoots(',ءبو')).toEqual(['ءبو']);
    });
});

describe('transformRootRow', () => {
    it('should transform a row with single root', () => {
        const row: RootRow = {
            root: new Uint8Array([0xc1, 0xc8, 0xe6]), // ءبو
            token: new Uint8Array([0xc2, 0xc8, 0xc7, 0xc1]), // آباء
        };

        const result = transformRootRow(row);

        expect(result.token).toBe('آباء');
        expect(result.roots).toEqual(['ءبو']);
    });

    it('should transform a row with multiple roots', () => {
        const row: RootRow = {
            root: new Uint8Array([0xc1, 0xca, 0xed, 0x2c, 0xc1, 0xca, 0xe6]), // ءتي,ءتو
            token: new Uint8Array([0xc2, 0xca, 0xc7, 0xdf]), // آتاك (example)
        };

        const result = transformRootRow(row);

        expect(result.roots.length).toBe(2);
        expect(result.roots).toContain('ءتي');
        expect(result.roots).toContain('ءتو');
    });

    it('should handle empty token and root', () => {
        const row: RootRow = {
            root: new Uint8Array([]),
            token: new Uint8Array([]),
        };

        const result = transformRootRow(row);

        expect(result.token).toBe('');
        expect(result.roots).toEqual([]);
    });
});

describe('createRootMap', () => {
    it('should return empty object for empty mappings', () => {
        expect(createRootMap([])).toEqual({});
    });

    it('should create map from single mapping', () => {
        const mappings: RootMapping[] = [{ roots: ['ءبو'], token: 'آباء' }];

        const result = createRootMap(mappings);

        expect(result['آباء']).toEqual(['ءبو']);
    });

    it('should create map from multiple mappings', () => {
        const mappings: RootMapping[] = [
            { roots: ['ءبو'], token: 'آباء' },
            { roots: ['ءتي', 'ءتو'], token: 'آتاك' },
        ];

        const result = createRootMap(mappings);

        expect(Object.keys(result).length).toBe(2);
        expect(result['آباء']).toEqual(['ءبو']);
        expect(result['آتاك']).toEqual(['ءتي', 'ءتو']);
    });

    it('should overwrite duplicate tokens (last wins)', () => {
        const mappings: RootMapping[] = [
            { roots: ['root1'], token: 'word' },
            { roots: ['root2'], token: 'word' },
        ];

        const result = createRootMap(mappings);

        expect(result['word']).toEqual(['root2']);
    });
});

describe('calculateStats', () => {
    it('should return zeros for empty mappings', () => {
        const stats = calculateStats([]);

        expect(stats.totalTokens).toBe(0);
        expect(stats.uniqueRoots).toBe(0);
        expect(stats.multiRootTokens).toBe(0);
        expect(stats.maxRootsPerToken).toBe(0);
    });

    it('should count total tokens', () => {
        const mappings: RootMapping[] = [
            { roots: ['r1'], token: 'a' },
            { roots: ['r2'], token: 'b' },
            { roots: ['r3'], token: 'c' },
        ];

        const stats = calculateStats(mappings);

        expect(stats.totalTokens).toBe(3);
    });

    it('should count unique roots', () => {
        const mappings: RootMapping[] = [
            { roots: ['r1'], token: 'a' },
            { roots: ['r1'], token: 'b' }, // same root
            { roots: ['r2'], token: 'c' },
        ];

        const stats = calculateStats(mappings);

        expect(stats.uniqueRoots).toBe(2);
    });

    it('should count multi-root tokens', () => {
        const mappings: RootMapping[] = [
            { roots: ['r1'], token: 'a' }, // single
            { roots: ['r1', 'r2'], token: 'b' }, // multi
            { roots: ['r1', 'r2', 'r3'], token: 'c' }, // multi
        ];

        const stats = calculateStats(mappings);

        expect(stats.multiRootTokens).toBe(2);
    });

    it('should find max roots per token', () => {
        const mappings: RootMapping[] = [
            { roots: ['r1'], token: 'a' },
            { roots: ['r1', 'r2'], token: 'b' },
            { roots: ['r1', 'r2', 'r3', 'r4', 'r5'], token: 'c' },
        ];

        const stats = calculateStats(mappings);

        expect(stats.maxRootsPerToken).toBe(5);
    });

    it('should handle tokens with empty roots array', () => {
        const mappings: RootMapping[] = [
            { roots: [], token: 'a' },
            { roots: ['r1'], token: 'b' },
        ];

        const stats = calculateStats(mappings);

        expect(stats.totalTokens).toBe(2);
        expect(stats.uniqueRoots).toBe(1);
        expect(stats.multiRootTokens).toBe(0);
    });
});

describe('Integration: Known Arabic Patterns', () => {
    it('should correctly decode and parse آباء → ءبو', () => {
        const row: RootRow = {
            root: new Uint8Array([0xc1, 0xc8, 0xe6]),
            token: new Uint8Array([0xc2, 0xc8, 0xc7, 0xc1]),
        };

        const result = transformRootRow(row);

        expect(result.token).toBe('آباء');
        expect(result.roots).toEqual(['ءبو']);
    });

    it('should correctly handle root lookup workflow', () => {
        const mappings: RootMapping[] = [
            { roots: ['ءبو'], token: 'آباء' },
            { roots: ['ءبو'], token: 'آباءكم' },
            { roots: ['ءتي', 'ءتو', 'ءتت'], token: 'آتاك' },
        ];

        const rootMap = createRootMap(mappings);

        // Simulate looking up a word
        expect(rootMap['آباء']).toEqual(['ءبو']);
        expect(rootMap['آتاك']).toContain('ءتي');
        expect(rootMap['nonexistent']).toBeUndefined();
    });

    it('should produce correct statistics for sample data', () => {
        const mappings: RootMapping[] = [
            { roots: ['ءبو'], token: 'آباء' },
            { roots: ['ءبو'], token: 'آباءكم' },
            { roots: ['ءبو'], token: 'آباءنا' },
            { roots: ['ءتي', 'ءتو', 'ءتت'], token: 'آتاك' },
        ];

        const stats = calculateStats(mappings);

        expect(stats.totalTokens).toBe(4);
        expect(stats.uniqueRoots).toBe(4); // ءبو, ءتي, ءتو, ءتت
        expect(stats.multiRootTokens).toBe(1); // only آتاك
        expect(stats.maxRootsPerToken).toBe(3);
    });
});
