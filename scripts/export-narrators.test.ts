/**
 * @fileoverview Unit tests for Narrator Export Functions
 */

import { describe, expect, it } from 'bun:test';
import {
    countUnmappedNarrators,
    type Narrator,
    type NarratorRow,
    removeNullValues,
    transformNarratorRow,
    validateNarrator,
} from './export-narrators';

describe('transformNarratorRow', () => {
    it('should transform a complete row with all fields', () => {
        const row: NarratorRow = {
            a: new Uint8Array([0x74, 0x43]), // بن
            b: new Uint8Array([0x68, 0x45, 0x68, 0x6b, 0x40, 0x74]), // metadata
            d: 220,
            i: 42,
            l: new Uint8Array([0x68, 0x45, 0x45, 0x47]), // الله
            s: new Uint8Array([0x68, 0x45, 0x45, 0x47]), // الله
        };

        const result = transformNarratorRow(row);

        expect(result.id).toBe(42);
        expect(result.shortName).toBe('الله');
        expect(result.longName).toBe('الله');
        expect(result.deathYear).toBe(220);
        expect(result.biography).toBe('بن');
    });

    it('should exclude deathYear when null', () => {
        const row: NarratorRow = {
            a: null,
            b: null,
            d: null,
            i: 1,
            l: new Uint8Array([0x68]), // ا
            s: new Uint8Array([0x68]), // ا
        };

        const result = transformNarratorRow(row);

        expect(result.deathYear).toBeUndefined();
        expect('deathYear' in result).toBe(false);
    });

    it('should handle null blobs as empty strings', () => {
        const row: NarratorRow = {
            a: null,
            b: null,
            d: null,
            i: 1,
            l: null,
            s: null,
        };

        const result = transformNarratorRow(row);

        expect(result.shortName).toBe('');
        expect(result.longName).toBe('');
        expect(result.biography).toBe('');
        expect(result.metadata).toBe('');
    });
});

describe('removeNullValues', () => {
    it('should remove null values', () => {
        const obj = { a: 1, b: null, c: 'test' };
        const result = removeNullValues(obj);

        expect(result.a).toBe(1);
        expect(result.c).toBe('test');
        expect('b' in result).toBe(false);
    });

    it('should remove undefined values', () => {
        const obj = { a: 1, b: undefined, c: 'test' };
        const result = removeNullValues(obj);

        expect('b' in result).toBe(false);
    });

    it('should remove empty string values', () => {
        const obj = { a: 1, b: '', c: 'test' };
        const result = removeNullValues(obj);

        expect('b' in result).toBe(false);
    });

    it('should keep zero values', () => {
        const obj = { a: 0, b: 'test' };
        const result = removeNullValues(obj);

        expect(result.a).toBe(0);
    });

    it('should keep false values', () => {
        const obj = { a: false, b: 'test' };
        const result = removeNullValues(obj);

        expect(result.a).toBe(false);
    });

    it('should return empty object for all-null input', () => {
        const obj = { a: null, b: undefined, c: '' };
        const result = removeNullValues(obj);

        expect(Object.keys(result).length).toBe(0);
    });
});

describe('countUnmappedNarrators', () => {
    it('should return zero counts for fully decoded narrators', () => {
        const narrators: Narrator[] = [
            {
                biography: 'من أئمة الحديث',
                id: 1,
                longName: 'محمد بن إسماعيل البخاري',
                metadata: 'الكنية: أبو عبد الله',
                shortName: 'البخاري',
            },
        ];

        const result = countUnmappedNarrators(narrators);

        expect(result.shortName).toBe(0);
        expect(result.longName).toBe(0);
        expect(result.biography).toBe(0);
        expect(result.metadata).toBe(0);
    });

    it('should count narrators with unmapped bytes in shortName', () => {
        const narrators: Narrator[] = [
            {
                biography: '',
                id: 1,
                longName: 'test',
                metadata: '',
                shortName: 'البخاري',
            },
            {
                biography: '',
                id: 2,
                longName: 'test',
                metadata: '',
                shortName: 'محمد [ab] البخاري',
            },
        ];

        const result = countUnmappedNarrators(narrators);

        expect(result.shortName).toBe(1);
    });

    it('should count each field independently', () => {
        const narrators: Narrator[] = [
            {
                biography: '[ef]',
                id: 1,
                longName: '[cd]',
                metadata: '[12]', // Use valid hex (0-9, a-f)
                shortName: '[ab]',
            },
        ];

        const result = countUnmappedNarrators(narrators);

        expect(result.shortName).toBe(1);
        expect(result.longName).toBe(1);
        expect(result.biography).toBe(1);
        expect(result.metadata).toBe(1);
    });
});

describe('validateNarrator', () => {
    const testNarrator: Narrator = {
        biography: 'biography text',
        id: 1,
        longName: 'محمد بن إسماعيل البخاري',
        metadata: 'metadata text',
        shortName: 'البخاري',
    };

    it('should return false for undefined narrator', () => {
        expect(validateNarrator(undefined, { shortName: 'test' })).toBe(false);
    });

    it('should return true when shortName matches', () => {
        expect(validateNarrator(testNarrator, { shortName: 'البخاري' })).toBe(true);
    });

    it('should return false when shortName does not match', () => {
        expect(validateNarrator(testNarrator, { shortName: 'wrong' })).toBe(false);
    });

    it('should return true when longName matches', () => {
        expect(validateNarrator(testNarrator, { longName: 'محمد بن إسماعيل البخاري' })).toBe(true);
    });

    it('should return false when longName does not match', () => {
        expect(validateNarrator(testNarrator, { longName: 'wrong' })).toBe(false);
    });

    it('should return true when both shortName and longName match', () => {
        expect(
            validateNarrator(testNarrator, {
                longName: 'محمد بن إسماعيل البخاري',
                shortName: 'البخاري',
            }),
        ).toBe(true);
    });

    it('should return false when shortName matches but longName does not', () => {
        expect(
            validateNarrator(testNarrator, {
                longName: 'wrong',
                shortName: 'البخاري',
            }),
        ).toBe(false);
    });

    it('should return true when no expected values provided', () => {
        expect(validateNarrator(testNarrator, {})).toBe(true);
    });
});
