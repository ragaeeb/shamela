import type { UnzippedEntry } from '@/utils/io';

/**
 * Enforces HTTPS protocol for a given URL string.
 *
 * @param originalUrl - The URL that may use an insecure scheme
 * @returns The normalized URL string using the HTTPS protocol
 */
export const fixHttpsProtocol = (originalUrl: string): string => {
    const url = new URL(originalUrl);
    url.protocol = 'https';

    return url.toString();
};

/**
 * Determines whether an archive entry contains a SQLite database file.
 *
 * @param entry - The entry extracted from an archive
 * @returns True when the entry name ends with a recognized SQLite extension
 */
export const isSqliteEntry = (entry: UnzippedEntry): boolean => /\.(sqlite|db)$/i.test(entry.name);

/**
 * Finds the first SQLite database entry from a list of archive entries.
 *
 * @param entries - The extracted entries to inspect
 * @returns The first matching entry or undefined when not present
 */
export const findSqliteEntry = (entries: UnzippedEntry[]): UnzippedEntry | undefined => {
    return entries.find(isSqliteEntry);
};

/**
 * Extracts the lowercase file extension from a path or filename.
 *
 * @param filePath - The path to inspect
 * @returns The lowercase extension (including the dot) or an empty string
 */
export const getExtension = (filePath: string): string => {
    const match = /\.([^.]+)$/.exec(filePath);
    return match ? `.${match[1].toLowerCase()}` : '';
};
