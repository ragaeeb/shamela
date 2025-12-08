/**
 * @fileoverview Narrator Plain Text Export Script
 *
 * Converts narrators-export.json to a plain text format with prefixed fields.
 *
 * Format:
 *   F{id} - shortName
 *   T{id} - longName (only if different from shortName)
 *   B{id} - biography
 *   P{id} - metadata
 *
 * @module export-narrators-txt
 */

import { readFileSync } from 'node:fs';

// ============================================================================
// Types
// ============================================================================

interface Narrator {
    id: number;
    shortName: string;
    longName: string;
    biography?: string;
    metadata?: string;
    deathYear?: number;
}

// ============================================================================
// Text Cleaning Functions
// ============================================================================

/**
 * Removes database reference IDs from text.
 * These are patterns like "(8/ 62)  712352" or "(1/ 102)  464602"
 * which are volume/page references followed by global reference IDs.
 *
 * @param text - The text to clean
 * @returns Text with database IDs removed
 */
export const stripDatabaseIds = (text: string): string => {
    // Remove 5-7 digit database IDs that follow a (vol/page) reference
    // Keep the (vol/page) citation and preserve any newlines
    // Pattern: "(2/ 57)\n 574624" → "(2/ 57)\n"
    return (
        text
            // First handle IDs on their own line after citation: "(2/ 57)\n 574624"
            .replace(/(\(\d+\/\s*\d+\))[ \t]*\n[ \t]*\d{5,7}/g, '$1\n')
            // Then handle IDs on same line as citation: "(2/ 57)  574624"
            .replace(/(\(\d+\/\s*\d+\))[ \t]+\d{5,7}/g, '$1')
            // Clean up any resulting multiple blank lines
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^ +| +$/gm, '')
            .trim()
    );
};

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Formats a single narrator to plain text lines.
 *
 * @param narrator - The narrator object
 * @returns Array of formatted lines
 */
export const formatNarrator = (narrator: Narrator): string[] => {
    const lines: string[] = [];
    const id = narrator.id;

    // F - shortName (always included)
    lines.push(`F${id} - ${narrator.shortName}`);

    // T - longName (only if different from shortName)
    if (narrator.longName && narrator.longName !== narrator.shortName) {
        lines.push(`T${id} - ${narrator.longName}`);
    }

    // B - biography (if present)
    if (narrator.biography) {
        // Strip database IDs, preserve line breaks
        const bio = stripDatabaseIds(narrator.biography).trim();
        if (bio) {
            lines.push(`B${id} - ${bio}`);
        }
    }

    // P - metadata (if present)
    if (narrator.metadata) {
        // Strip database IDs, preserve line breaks
        const meta = stripDatabaseIds(narrator.metadata).trim();
        if (meta) {
            lines.push(`P${id} - ${meta}`);
        }
    }

    // Skip deathYear as requested

    return lines;
};

/**
 * Converts all narrators to plain text format.
 *
 * @param narrators - Array of narrator objects
 * @returns Complete plain text output
 */
export const formatAllNarrators = (narrators: Narrator[]): string => {
    const allLines: string[] = [];

    for (const narrator of narrators) {
        const lines = formatNarrator(narrator);
        allLines.push(...lines);
        allLines.push(''); // Empty line between narrators
    }

    return allLines.join('\n');
};

// ============================================================================
// Main Entry Point
// ============================================================================

const main = async () => {
    const inputPath = new URL('../database/narrators-export.json', import.meta.url).pathname;
    const outputPath = new URL('../database/narrators-export.txt', import.meta.url).pathname;

    console.log(`Reading: ${inputPath}`);
    const jsonContent = readFileSync(inputPath, 'utf-8');
    const narrators: Narrator[] = JSON.parse(jsonContent);

    console.log(`Processing ${narrators.length} narrators...`);
    const textOutput = formatAllNarrators(narrators);

    console.log(`Writing: ${outputPath}`);
    await Bun.write(outputPath, textOutput);

    // Print sample
    console.log('\n=== Sample Output (first 3 narrators) ===\n');
    const sampleNarrators = narrators.slice(0, 3);
    for (const n of sampleNarrators) {
        const lines = formatNarrator(n);
        console.log(lines.join('\n'));
        console.log();
    }

    console.log(`\nExported ${narrators.length} narrators to ${outputPath}`);
};

// Run if executed directly
if (import.meta.main) {
    main();
}
