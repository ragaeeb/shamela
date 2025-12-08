/**
 * @fileoverview Shamela Narrator Export Script
 *
 * Exports narrator data from the Shamela S1.db database to JSON format.
 * Uses the shamela-decoder module to decode the custom Shamela encoding.
 *
 * @module export-narrators
 * @requires bun:sqlite
 * @requires ./shamela-decoder
 */

import { Database } from 'bun:sqlite';
import { decodeShamelaMetadata, decodeShamelaText, hasUnmappedBytes } from './shamela-decoder';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw narrator row from the SQLite database.
 * Column names are single letters in the original schema.
 */
export interface NarratorRow {
    /** Narrator ID (primary key) */
    i: number;
    /** Short name (encoded blob) */
    s: Uint8Array | null;
    /** Long name (encoded blob) */
    l: Uint8Array | null;
    /** Death year (Hijri calendar) */
    d: number | null;
    /** Biography text (encoded blob) */
    a: Uint8Array | null;
    /** Metadata/attributes (encoded blob) */
    b: Uint8Array | null;
}

/**
 * Decoded narrator data for export.
 * Only includes non-null fields in the output.
 */
export interface Narrator {
    /** Narrator ID */
    id: number;
    /** Short display name */
    shortName: string;
    /** Full name with lineage */
    longName: string;
    /** Death year in Hijri calendar (optional) */
    deathYear?: number;
    /** Biography text with scholar opinions */
    biography: string;
    /** Structured metadata (nickname, lineage, etc.) */
    metadata: string;
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Opens the Shamela narrator database.
 *
 * @param dbPath - Path to the S1.db SQLite database
 * @returns Database connection in readonly mode
 */
const openDatabase = (dbPath: string) => new Database(dbPath, { readonly: true });

/**
 * Fetches all narrator rows from the database.
 *
 * @param db - Database connection
 * @returns Array of raw narrator rows
 */
const fetchNarratorRows = (db: Database) => {
    const query = db.query<NarratorRow, []>('SELECT i, s, l, d, a, b FROM b ORDER BY i');
    return query.all();
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transforms a raw database row into a decoded Narrator object.
 * Excludes null/undefined values from the output.
 *
 * @param row - Raw narrator row from database
 * @returns Decoded narrator object without null fields
 */
export const transformNarratorRow = (row: NarratorRow) => {
    const narrator: Narrator = {
        biography: decodeShamelaText(row.a),
        id: row.i,
        longName: decodeShamelaText(row.l),
        metadata: decodeShamelaMetadata(row.b),
        shortName: decodeShamelaText(row.s),
    };

    // Only include deathYear if it exists
    if (row.d !== null && row.d !== undefined) {
        narrator.deathYear = row.d;
    }

    return narrator;
};

/**
 * Transforms all narrator rows to decoded objects.
 *
 * @param rows - Array of raw narrator rows
 * @returns Array of decoded narrator objects
 */
export const transformAllNarrators = (rows: NarratorRow[]) => rows.map(transformNarratorRow);

/**
 * Removes null and undefined values from an object for cleaner JSON output.
 *
 * @param obj - Object to clean
 * @returns Object with null/undefined values removed
 */
export const removeNullValues = <T extends Record<string, unknown>>(obj: T) => {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
            result[key as keyof T] = value as T[keyof T];
        }
    }
    return result;
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Counts narrators with unmapped bytes in their decoded text.
 *
 * @param narrators - Array of decoded narrators
 * @returns Object with counts for each field
 */
export const countUnmappedNarrators = (narrators: Narrator[]) => ({
    biography: narrators.filter((n) => hasUnmappedBytes(n.biography)).length,
    longName: narrators.filter((n) => hasUnmappedBytes(n.longName)).length,
    metadata: narrators.filter((n) => hasUnmappedBytes(n.metadata)).length,
    shortName: narrators.filter((n) => hasUnmappedBytes(n.shortName)).length,
});

/**
 * Validates a narrator against expected values.
 *
 * @param narrator - Narrator to validate
 * @param expected - Expected values to check
 * @returns True if narrator matches expected values
 */
export const validateNarrator = (
    narrator: Narrator | undefined,
    expected: { shortName?: string; longName?: string },
) => {
    if (!narrator) {
        return false;
    }

    if (expected.shortName && narrator.shortName !== expected.shortName) {
        return false;
    }
    if (expected.longName && narrator.longName !== expected.longName) {
        return false;
    }
    return true;
};

// ============================================================================
// Output Functions
// ============================================================================

/**
 * Writes narrators to a JSON file, excluding null/empty values.
 *
 * @param narrators - Array of narrators to write
 * @param outputPath - Path to output JSON file
 */
const writeNarratorsJson = async (narrators: Narrator[], outputPath: string) => {
    // Clean each narrator object before writing
    const cleanedNarrators = narrators.map((n) => removeNullValues(n));
    await Bun.write(outputPath, JSON.stringify(cleanedNarrators, null, 2));
};

/**
 * Prints verification results for known narrators.
 *
 * @param narrators - Array of all narrators
 */
const printVerificationResults = (narrators: Narrator[]) => {
    console.log('\n=== Verification Tests ===');

    // Test cases with expected values
    const testCases = [
        { expected: 'عبيد الله بن موسى بن أبي المختار', id: 4210 },
        { expected: 'البخاري', id: 5495 },
        { expected: 'آدم بن أبي إياس', id: 3 },
        { expected: 'إبراهيم بن سالم بن أبي أمية', id: 48 },
    ];

    for (const test of testCases) {
        const narrator = narrators.find((n) => n.id === test.id);
        if (narrator) {
            const match = narrator.shortName === test.expected ? '✓' : '✗';
            console.log(`\nID ${test.id}: ${match}`);
            console.log(`  Decoded:  ${narrator.shortName}`);
            console.log(`  Expected: ${test.expected}`);
            if (narrator.biography) {
                console.log(`  Biography: ${narrator.biography.length} chars`);
            }
            if (narrator.metadata) {
                console.log(`  Metadata: ${narrator.metadata.length} chars`);
            }
        }
    }

    // Print unmapped byte statistics
    const unmapped = countUnmappedNarrators(narrators);
    console.log('\n=== Unmapped Byte Statistics ===');
    console.log(`  Short names: ${unmapped.shortName} narrators with unmapped bytes`);
    console.log(`  Long names: ${unmapped.longName} narrators with unmapped bytes`);
    console.log(`  Biographies: ${unmapped.biography} narrators with unmapped bytes`);
    console.log(`  Metadata: ${unmapped.metadata} narrators with unmapped bytes`);
};

/**
 * Prints a sample of narrators for quick inspection.
 *
 * @param narrators - Array of all narrators
 * @param count - Number of samples to print
 */
const printSample = (narrators: Narrator[], count: number = 5) => {
    console.log(`\n=== Sample (first ${count}) ===`);
    for (const n of narrators.slice(0, count)) {
        const deathStr = n.deathYear ? `d. ${n.deathYear}H` : 'd. ?H';
        console.log(`\n${n.id}: ${n.shortName} (${deathStr})`);
        if (n.biography) {
            console.log(`  Bio: ${n.biography.substring(0, 80)}...`);
        }
        if (n.metadata) {
            console.log(`  Meta: ${n.metadata.substring(0, 60)}...`);
        }
    }
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main export function.
 * Reads narrators from S1.db, decodes them, and writes to JSON.
 */
const main = async () => {
    const dbPath = new URL('../database/service/S1.db', import.meta.url).pathname;
    const outputPath = new URL('../database/narrators-export.json', import.meta.url).pathname;

    console.log(`Opening database: ${dbPath}`);
    const db = openDatabase(dbPath);

    try {
        // Fetch and transform data
        const rows = fetchNarratorRows(db);
        console.log(`Found ${rows.length} narrators`);

        const narrators = transformAllNarrators(rows);

        // Write output
        await writeNarratorsJson(narrators, outputPath);
        console.log(`Exported to: ${outputPath}`);

        // Verification and samples
        printVerificationResults(narrators);
        printSample(narrators);
    } finally {
        db.close();
    }
};

// Run if executed directly (not when imported as a module)
if (import.meta.main) {
    main();
}
