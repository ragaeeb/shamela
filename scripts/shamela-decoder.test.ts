/**
 * @fileoverview Unit tests for Shamela Text Decoder
 *
 * Tests the character mapping and decoding functions for the
 * custom Shamela encoding used in their Arabic text databases.
 */

import { describe, expect, it } from 'bun:test';
import {
    countUnmappedBytes,
    decodeBytes,
    decodeShamelaMetadata,
    decodeShamelaText,
    getUnmappedBytes,
    hasUnmappedBytes,
    METADATA_CHAR_MAP,
    SHAMELA_CHAR_MAP,
} from './shamela-decoder';

describe('SHAMELA_CHAR_MAP', () => {
    it('should map space correctly', () => {
        expect(SHAMELA_CHAR_MAP[0x40]).toBe(' ');
    });

    it('should map core Arabic letters', () => {
        expect(SHAMELA_CHAR_MAP[0x43]).toBe('ن'); // nun
        expect(SHAMELA_CHAR_MAP[0x45]).toBe('ل'); // lam
        expect(SHAMELA_CHAR_MAP[0x46]).toBe('م'); // mim
        expect(SHAMELA_CHAR_MAP[0x47]).toBe('ه'); // ha
        expect(SHAMELA_CHAR_MAP[0x68]).toBe('ا'); // alif
        expect(SHAMELA_CHAR_MAP[0x74]).toBe('ب'); // ba
        expect(SHAMELA_CHAR_MAP[0x77]).toBe('د'); // dal
    });

    it('should map hamza variants', () => {
        expect(SHAMELA_CHAR_MAP[0x62]).toBe('آ'); // alif with madda
        expect(SHAMELA_CHAR_MAP[0x66]).toBe('أ'); // alif with hamza above
        expect(SHAMELA_CHAR_MAP[0x67]).toBe('إ'); // alif with hamza below
        expect(SHAMELA_CHAR_MAP[0x63]).toBe('ؤ'); // waw with hamza
    });

    it('should map numerals 0-9', () => {
        expect(SHAMELA_CHAR_MAP[0xf0]).toBe('0');
        expect(SHAMELA_CHAR_MAP[0xf1]).toBe('1');
        expect(SHAMELA_CHAR_MAP[0xf2]).toBe('2');
        expect(SHAMELA_CHAR_MAP[0xf3]).toBe('3');
        expect(SHAMELA_CHAR_MAP[0xf4]).toBe('4');
        expect(SHAMELA_CHAR_MAP[0xf5]).toBe('5');
        expect(SHAMELA_CHAR_MAP[0xf6]).toBe('6');
        expect(SHAMELA_CHAR_MAP[0xf7]).toBe('7');
        expect(SHAMELA_CHAR_MAP[0xf8]).toBe('8');
        expect(SHAMELA_CHAR_MAP[0xf9]).toBe('9');
    });

    it('should map control bytes to empty string', () => {
        expect(SHAMELA_CHAR_MAP[0x14]).toBe('');
        expect(SHAMELA_CHAR_MAP[0x4a]).toBe('');
        expect(SHAMELA_CHAR_MAP[0x4b]).toBe('');
        expect(SHAMELA_CHAR_MAP[0x7f]).toBe('');
        expect(SHAMELA_CHAR_MAP[0xc0]).toBe('');
    });

    it('should map 0x6b to newline (structural separator)', () => {
        expect(SHAMELA_CHAR_MAP[0x6b]).toBe('\n');
    });

    it('should map ayn correctly (0xfe)', () => {
        expect(SHAMELA_CHAR_MAP[0xfe]).toBe('ع');
    });
});

describe('METADATA_CHAR_MAP', () => {
    it('should override 0x6b to colon for field separation', () => {
        expect(METADATA_CHAR_MAP[0x6b]).toBe(':');
    });

    it('should strip 0x94 in metadata headers', () => {
        expect(METADATA_CHAR_MAP[0x94]).toBe('');
    });

    it('should inherit other mappings from SHAMELA_CHAR_MAP', () => {
        expect(METADATA_CHAR_MAP[0x40]).toBe(' ');
        expect(METADATA_CHAR_MAP[0x43]).toBe('ن');
        expect(METADATA_CHAR_MAP[0x68]).toBe('ا');
    });
});

describe('decodeBytes', () => {
    it('should return empty string for null input', () => {
        expect(decodeBytes(null)).toBe('');
    });

    it('should return empty string for empty array', () => {
        expect(decodeBytes(new Uint8Array([]))).toBe('');
    });

    it('should decode الله correctly', () => {
        // الله = h E E G = 0x68 0x45 0x45 0x47
        const encoded = new Uint8Array([0x68, 0x45, 0x45, 0x47]);
        expect(decodeBytes(encoded)).toBe('الله');
    });

    it('should decode بن correctly', () => {
        // بن = t C = 0x74 0x43
        const encoded = new Uint8Array([0x74, 0x43]);
        expect(decodeBytes(encoded)).toBe('بن');
    });

    it('should decode آدم correctly', () => {
        // آدم = b w F = 0x62 0x77 0x46
        const encoded = new Uint8Array([0x62, 0x77, 0x46]);
        expect(decodeBytes(encoded)).toBe('آدم');
    });

    it('should show unmapped bytes as hex placeholders', () => {
        const encoded = new Uint8Array([0x00, 0x01, 0x02]);
        expect(decodeBytes(encoded)).toBe('[00][01][02]');
    });

    it('should handle mixed mapped and unmapped bytes', () => {
        // ال + unmapped + ا = 0x68 0x45 + 0x00 + 0x68
        const encoded = new Uint8Array([0x68, 0x45, 0x00, 0x68]);
        expect(decodeBytes(encoded)).toBe('ال[00]ا');
    });

    it('should trim leading and trailing whitespace', () => {
        // space + ا + space = 0x40 0x68 0x40
        const encoded = new Uint8Array([0x40, 0x68, 0x40]);
        expect(decodeBytes(encoded)).toBe('ا');
    });

    it('should use custom charMap when provided', () => {
        const customMap: Record<number, string> = { 65: 'X', 66: 'Y' };
        const encoded = new Uint8Array([0x41, 0x42]);
        expect(decodeBytes(encoded, customMap)).toBe('XY');
    });
});

describe('decodeShamelaText', () => {
    it('should return empty string for null input', () => {
        expect(decodeShamelaText(null)).toBe('');
    });

    it('should decode using SHAMELA_CHAR_MAP', () => {
        // البخاري = h E t v h i U = 0x68 0x45 0x74 0x76 0x68 0x69 0x55
        const encoded = new Uint8Array([0x68, 0x45, 0x74, 0x76, 0x68, 0x69, 0x55]);
        expect(decodeShamelaText(encoded)).toBe('البخاري');
    });

    it('should decode names with spaces correctly', () => {
        // ابن = h t C (with space after)
        const encoded = new Uint8Array([0x68, 0x74, 0x43, 0x40, 0x75, 0x78, 0x69]);
        // ابن حجر
        expect(decodeShamelaText(encoded)).toBe('ابن حجر');
    });
});

describe('decodeShamelaMetadata', () => {
    it('should return empty string for null input', () => {
        expect(decodeShamelaMetadata(null)).toBe('');
    });

    it('should use : for field separator (0x6b)', () => {
        // field_name + 0x6b + value = name: value
        // Using simple mock: الا + : + ب
        const encoded = new Uint8Array([0x68, 0x45, 0x68, 0x6b, 0x40, 0x74]);
        const decoded = decodeShamelaMetadata(encoded);
        expect(decoded).toContain(':');
    });

    it('should remove leading colon from output', () => {
        // : + text = text (without leading :)
        const encoded = new Uint8Array([0x6b, 0x40, 0x74, 0x43]);
        const decoded = decodeShamelaMetadata(encoded);
        expect(decoded.startsWith(':')).toBe(false);
    });

    it('should remove colons after newlines', () => {
        // newline + : should become just newline
        const encoded = new Uint8Array([0x68, 0x5a, 0x6b, 0x40, 0x74]);
        const decoded = decodeShamelaMetadata(encoded);
        expect(decoded).not.toContain('\n:');
    });
});

describe('hasUnmappedBytes', () => {
    it('should return false for empty string', () => {
        expect(hasUnmappedBytes('')).toBe(false);
    });

    it('should return false for fully decoded text', () => {
        expect(hasUnmappedBytes('البخاري')).toBe(false);
    });

    it('should return true when hex placeholders present', () => {
        expect(hasUnmappedBytes('Hello [ab] World')).toBe(true);
    });

    it('should return true for lowercase hex', () => {
        expect(hasUnmappedBytes('[ff]')).toBe(true);
    });

    it('should return true for uppercase hex', () => {
        expect(hasUnmappedBytes('[FF]')).toBe(true);
    });

    it('should return false for non-hex brackets', () => {
        expect(hasUnmappedBytes('[xyz]')).toBe(false);
        expect(hasUnmappedBytes('[123]')).toBe(false);
    });
});

describe('getUnmappedBytes', () => {
    it('should return empty array for no unmapped bytes', () => {
        expect(getUnmappedBytes('البخاري')).toEqual([]);
    });

    it('should extract single unmapped byte', () => {
        expect(getUnmappedBytes('Hello [ab] World')).toEqual(['ab']);
    });

    it('should extract multiple unique unmapped bytes', () => {
        const result = getUnmappedBytes('Test [ab] text [cd] end');
        expect(result).toContain('ab');
        expect(result).toContain('cd');
        expect(result.length).toBe(2);
    });

    it('should return unique values only', () => {
        const result = getUnmappedBytes('[ab] [ab] [ab]');
        expect(result).toEqual(['ab']);
    });

    it('should normalize to lowercase', () => {
        const result = getUnmappedBytes('[AB] [Cd]');
        expect(result).toContain('ab');
        expect(result).toContain('cd');
    });
});

describe('countUnmappedBytes', () => {
    it('should return empty map for no unmapped bytes', () => {
        const result = countUnmappedBytes('البخاري');
        expect(result.size).toBe(0);
    });

    it('should count single occurrence', () => {
        const result = countUnmappedBytes('Hello [ab] World');
        expect(result.get('ab')).toBe(1);
    });

    it('should count multiple occurrences of same byte', () => {
        const result = countUnmappedBytes('[ab] test [ab] test [ab]');
        expect(result.get('ab')).toBe(3);
    });

    it('should count different bytes separately', () => {
        const result = countUnmappedBytes('[ab] [cd] [ab]');
        expect(result.get('ab')).toBe(2);
        expect(result.get('cd')).toBe(1);
    });

    it('should normalize to lowercase', () => {
        const result = countUnmappedBytes('[AB] [ab]');
        expect(result.get('ab')).toBe(2);
    });
});

describe('Integration: Known Narrator Patterns', () => {
    it('should decode ID 4210: عبيد الله بن موسى بن أبي المختار', () => {
        // عبيد الله = þ t U w @ h E E G
        // 0xfe 0x74 0x55 0x77 0x40 0x68 0x45 0x45 0x47
        const encoded = new Uint8Array([
            0xfe,
            0x74,
            0x55,
            0x77,
            0x40, // عبيد
            0x68,
            0x45,
            0x45,
            0x47, // الله
        ]);
        expect(decodeShamelaText(encoded)).toBe('عبيد الله');
    });

    it('should decode أبي with hamza above', () => {
        // أبي = f t U = 0x66 0x74 0x55
        const encoded = new Uint8Array([0x66, 0x74, 0x55]);
        expect(decodeShamelaText(encoded)).toBe('أبي');
    });

    it('should decode volume/page reference like (1/ 65)', () => {
        // (1/ 65) = M ñ a @ ö õ ] = 0x4d 0xf1 0x61 0x40 0xf6 0xf5 0x5d
        const encoded = new Uint8Array([0x4d, 0xf1, 0x61, 0x40, 0xf6, 0xf5, 0x5d]);
        expect(decodeShamelaText(encoded)).toBe('(1/ 65)');
    });

    it('should decode hijri year abbreviation هـ', () => {
        // هـ = G ü = 0x47 0xfc
        const encoded = new Uint8Array([0x47, 0xfc]);
        expect(decodeShamelaText(encoded)).toBe('هـ');
    });
});
