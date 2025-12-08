/**
 * @fileoverview Arabic Root Morphology Export Script
 *
 * Exports Arabic token→root mappings from Shamela S2.db to JSON format.
 * The database contains 3.2 million mappings from inflected Arabic words
 * to their root forms, useful for Arabic NLP and morphological analysis.
 *
 * @module export-roots
 * @requires bun:sqlite
 */

import { Database } from 'bun:sqlite';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw row from the roots table.
 */
export interface RootRow {
    token: Uint8Array;
    root: Uint8Array;
}

/**
 * Decoded root mapping for export.
 */
export interface RootMapping {
    /** The inflected Arabic word */
    token: string;
    /** The root form(s), comma-separated if multiple */
    roots: string[];
}

// ============================================================================
// Decoding Functions
// ============================================================================

/**
 * Windows-1256 to Unicode mapping table (Arabic codepage).
 * Covers bytes 0x80-0xFF which are the extended characters.
 * Bytes 0x00-0x7F are standard ASCII.
 */
export const WINDOWS_1256_MAP: Record<number, string> = {
    128: '\u20AC', // Euro sign
    129: '\u067E', // پ
    130: '\u201A', // ‚
    131: '\u0192', // ƒ
    132: '\u201E', // „
    133: '\u2026', // …
    134: '\u2020', // †
    135: '\u2021', // ‡
    136: '\u02C6', // ˆ
    137: '\u2030', // ‰
    138: '\u0679', // ٹ
    139: '\u2039', // ‹
    140: '\u0152', // Œ
    141: '\u0686', // چ
    142: '\u0698', // ژ
    143: '\u0688', // ڈ
    144: '\u06AF', // گ
    145: '\u2018', // '
    146: '\u2019', // '
    147: '\u201C', // "
    148: '\u201D', // "
    149: '\u2022', // •
    150: '\u2013', // –
    151: '\u2014', // —
    152: '\u06A9', // ک
    153: '\u2122', // ™
    154: '\u0691', // ڑ
    155: '\u203A', // ›
    156: '\u0153', // œ
    157: '\u200C', // ZWNJ
    158: '\u200D', // ZWJ
    159: '\u06BA', // ں
    160: '\u00A0', // NBSP
    161: '\u060C', // ،
    162: '\u00A2', // ¢
    163: '\u00A3', // £
    164: '\u00A4', // ¤
    165: '\u00A5', // ¥
    166: '\u00A6', // ¦
    167: '\u00A7', // §
    168: '\u00A8', // ¨
    169: '\u00A9', // ©
    170: '\u06BE', // ھ
    171: '\u00AB', // «
    172: '\u00AC', // ¬
    173: '\u00AD', // SHY
    174: '\u00AE', // ®
    175: '\u00AF', // ¯
    176: '\u00B0', // °
    177: '\u00B1', // ±
    178: '\u00B2', // ²
    179: '\u00B3', // ³
    180: '\u00B4', // ´
    181: '\u00B5', // µ
    182: '\u00B6', // ¶
    183: '\u00B7', // ·
    184: '\u00B8', // ¸
    185: '\u00B9', // ¹
    186: '\u061B', // ؛
    187: '\u00BB', // »
    188: '\u00BC', // ¼
    189: '\u00BD', // ½
    190: '\u00BE', // ¾
    191: '\u061F', // ؟
    192: '\u06C1', // ہ
    193: '\u0621', // ء
    194: '\u0622', // آ
    195: '\u0623', // أ
    196: '\u0624', // ؤ
    197: '\u0625', // إ
    198: '\u0626', // ئ
    199: '\u0627', // ا
    200: '\u0628', // ب
    201: '\u0629', // ة
    202: '\u062A', // ت
    203: '\u062B', // ث
    204: '\u062C', // ج
    205: '\u062D', // ح
    206: '\u062E', // خ
    207: '\u062F', // د
    208: '\u0630', // ذ
    209: '\u0631', // ر
    210: '\u0632', // ز
    211: '\u0633', // س
    212: '\u0634', // ش
    213: '\u0635', // ص
    214: '\u0636', // ض
    215: '\u00D7', // ×
    216: '\u0637', // ط
    217: '\u0638', // ظ
    218: '\u0639', // ع
    219: '\u063A', // غ
    220: '\u0640', // ـ
    221: '\u0641', // ف
    222: '\u0642', // ق
    223: '\u0643', // ك
    224: '\u00E0', // à
    225: '\u0644', // ل
    226: '\u00E2', // â
    227: '\u0645', // م
    228: '\u0646', // ن
    229: '\u0647', // ه
    230: '\u0648', // و
    231: '\u00E7', // ç
    232: '\u00E8', // è
    233: '\u00E9', // é
    234: '\u00EA', // ê
    235: '\u00EB', // ë
    236: '\u0649', // ى
    237: '\u064A', // ي
    238: '\u00EE', // î
    239: '\u00EF', // ï
    240: '\u064B', // ً
    241: '\u064C', // ٌ
    242: '\u064D', // ٍ
    243: '\u064E', // َ
    244: '\u00F4', // ô
    245: '\u064F', // ُ
    246: '\u0650', // ِ
    247: '\u00F7', // ÷
    248: '\u0651', // ّ
    249: '\u00F9', // ù
    250: '\u0652', // ْ
    251: '\u00FB', // û
    252: '\u00FC', // ü
    253: '\u200E', // LRM
    254: '\u200F', // RLM
    255: '\u06D2', // ے
};

/**
 * Decodes a Windows-1256 encoded byte array to string.
 * S2.db uses Windows-1256 encoding (standard Arabic Windows codepage).
 *
 * @param blob - The encoded byte array
 * @returns Decoded Arabic string
 */
export const decodeWindows1256 = (blob: Uint8Array | null): string => {
    if (!blob) {
        return '';
    }

    const chars: string[] = [];
    for (const byte of blob) {
        if (byte < 0x80) {
            // ASCII range
            chars.push(String.fromCharCode(byte));
        } else {
            // Extended range - use mapping table
            const mapped = WINDOWS_1256_MAP[byte];
            if (mapped) {
                chars.push(mapped);
            } else {
                // Fallback for unmapped characters (shouldn't happen with a complete map)
                chars.push(String.fromCharCode(byte));
            }
        }
    }
    return chars.join('');
};

/**
 * Parses root string which may contain multiple roots separated by commas.
 * Example: "ءتي,ءتو,ءتت" → ["ءتي", "ءتو", "ءتت"]
 *
 * @param rootStr - Comma-separated root string
 * @returns Array of individual roots
 */
export const parseRoots = (rootStr: string): string[] => {
    if (!rootStr) {
        return [];
    }
    return rootStr
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
};

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Opens the Arabic roots database.
 *
 * @param dbPath - Path to S2.db
 * @returns Database connection in readonly mode
 */
const openDatabase = (dbPath: string) => new Database(dbPath, { readonly: true });

/**
 * Fetches all root mappings from the database.
 *
 * @param db - Database connection
 * @returns Array of raw root rows
 */
const fetchRootRows = (db: Database) => {
    const query = db.query<RootRow, []>('SELECT token, root FROM roots');
    return query.all();
};

/**
 * Transforms a raw database row into a decoded RootMapping.
 *
 * @param row - Raw root row from database
 * @returns Decoded root mapping
 */
export const transformRootRow = (row: RootRow): RootMapping => ({
    roots: parseRoots(decodeWindows1256(row.root)),
    token: decodeWindows1256(row.token),
});

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Writes root mappings to a JSON file.
 *
 * @param mappings - Array of root mappings
 * @param outputPath - Path to output JSON file
 */
const writeRootsJson = async (mappings: RootMapping[], outputPath: string) => {
    await Bun.write(outputPath, JSON.stringify(mappings, null, 2));
};

/**
 * Writes root mappings to a compact JSON file (no pretty printing).
 * Better for large datasets like 3.2M records.
 *
 * @param mappings - Array of root mappings
 * @param outputPath - Path to output JSON file
 */
const writeRootsJsonCompact = async (mappings: RootMapping[], outputPath: string) => {
    await Bun.write(outputPath, JSON.stringify(mappings));
};

/**
 * Creates a simplified token→roots map for smaller output.
 * Reduces the object overhead by using a simple key-value structure.
 *
 * @param mappings - Array of root mappings
 * @returns Object mapping token to roots array
 */
export const createRootMap = (mappings: RootMapping[]): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    for (const m of mappings) {
        map[m.token] = m.roots;
    }
    return map;
};

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Calculates statistics about the root mappings.
 */
export const calculateStats = (mappings: RootMapping[]) => {
    const uniqueRoots = new Set<string>();
    let multiRootCount = 0;
    let maxRoots = 0;

    for (const m of mappings) {
        if (m.roots.length > 1) {
            multiRootCount++;
        }
        if (m.roots.length > maxRoots) {
            maxRoots = m.roots.length;
        }
        for (const r of m.roots) {
            uniqueRoots.add(r);
        }
    }

    return {
        maxRootsPerToken: maxRoots,
        multiRootTokens: multiRootCount,
        totalTokens: mappings.length,
        uniqueRoots: uniqueRoots.size,
    };
};

// ============================================================================
// Main Entry Point
// ============================================================================

const main = async () => {
    const dbPath = new URL('../database/service/S2.db', import.meta.url).pathname;
    const outputPath = new URL('../database/roots-export.json', import.meta.url).pathname;
    const outputPathCompact = new URL('../database/roots-export.min.json', import.meta.url).pathname;
    const outputPathMap = new URL('../database/roots-map.json', import.meta.url).pathname;

    console.log(`Opening database: ${dbPath}`);
    const db = openDatabase(dbPath);

    try {
        console.log('Fetching root mappings...');
        const rows = fetchRootRows(db);
        console.log(`Found ${rows.length.toLocaleString()} token→root mappings`);

        console.log('Transforming data...');
        const mappings = rows.map(transformRootRow);

        // Calculate and print statistics
        const stats = calculateStats(mappings);
        console.log('\n=== Statistics ===');
        console.log(`  Total tokens: ${stats.totalTokens.toLocaleString()}`);
        console.log(`  Unique roots: ${stats.uniqueRoots.toLocaleString()}`);
        console.log(`  Tokens with multiple roots: ${stats.multiRootTokens.toLocaleString()}`);
        console.log(`  Max roots per token: ${stats.maxRootsPerToken}`);

        // Write outputs
        console.log('\nWriting output files...');

        // Compact array format (smaller)
        console.log(`  Writing ${outputPathCompact}...`);
        await writeRootsJsonCompact(mappings, outputPathCompact);

        // Map format (fastest lookup)
        console.log(`  Writing ${outputPathMap}...`);
        const rootMap = createRootMap(mappings);
        await Bun.write(outputPathMap, JSON.stringify(rootMap));

        console.log('\n=== Export Complete ===');
        console.log(`  Compact JSON: ${outputPathCompact}`);
        console.log(`  Map JSON: ${outputPathMap}`);

        // Sample output
        console.log('\n=== Sample Mappings ===');
        for (const m of mappings.slice(0, 10)) {
            console.log(`  ${m.token} → ${m.roots.join(', ')}`);
        }
    } finally {
        db.close();
    }
};

// Run if executed directly
if (import.meta.main) {
    main();
}
