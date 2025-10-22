import { requireConfigValue } from './config.js';
import { createDatabase, openDatabase, type SqliteDatabase } from './db/sqlite.js';
import { applyPatches, copyTableData, createTables as createBookTables, getData as getBookData } from './db/book.js';
import {
    copyForeignMasterTableData,
    createTables as createMasterTables,
    getData as getMasterData,
} from './db/master.js';
import type {
    BookData,
    DownloadBookOptions,
    DownloadMasterOptions,
    MasterData,
    GetBookMetadataOptions,
    GetBookMetadataResponsePayload,
    GetMasterMetadataResponsePayload,
} from './types.js';
import { mapPageRowToPage, mapTitleRowToTitle, redactUrl } from './utils/common.js';
import { DEFAULT_MASTER_METADATA_VERSION } from './utils/constants.js';
import type { UnzippedEntry } from './utils/io.js';
import { unzipFromUrl, writeOutput } from './utils/io.js';
import logger from './utils/logger.js';
import { buildUrl, httpsGet } from './utils/network.js';
import { validateEnvVariables, validateMasterSourceTables } from './utils/validation.js';

/**
 * Normalises download URLs by enforcing HTTPS regardless of the source protocol.
 *
 * @param originalUrl - The URL to normalise
 * @returns The URL string using the HTTPS protocol
 */
const fixHttpsProtocol = (originalUrl: string) => {
    const url = new URL(originalUrl);
    url.protocol = 'https';

    return url.toString();
};

/**
 * Response payload received when requesting book update metadata from the Shamela API.
 */
type BookUpdatesResponse = {
    major_release: number;
    major_release_url: string;
    minor_release?: number;
    minor_release_url?: string;
};

/**
 * Determines whether an extracted archive entry represents a SQLite database.
 *
 * @param entry - The archive entry to inspect
 * @returns True when the entry file name ends with .sqlite or .db
 */
const isSqliteEntry = (entry: UnzippedEntry) => /\.(sqlite|db)$/i.test(entry.name);

/**
 * Finds the first SQLite entry from a collection of extracted archive entries.
 *
 * @param entries - The archive entries to search through
 * @returns The matching entry if found, otherwise undefined
 */
const findSqliteEntry = (entries: UnzippedEntry[]) => {
    return entries.find(isSqliteEntry);
};

/**
 * Extracts the lowercase file extension from the provided path.
 *
 * @param filePath - The path or filename to inspect
 * @returns The file extension including the leading dot, or an empty string when absent
 */
const getExtension = (filePath: string) => {
    const match = /\.([^.]+)$/.exec(filePath);
    return match ? `.${match[1].toLowerCase()}` : '';
};

/**
 * Sets up a book database with tables and data, returning the database client.
 *
 * This helper function handles the common logic of downloading book files,
 * creating database tables, and applying patches or copying data.
 *
 * @param id - The unique identifier of the book
 * @param bookMetadata - Optional pre-fetched book metadata
 * @returns A promise that resolves to an object containing the database client and cleanup function
 */
const setupBookDatabase = async (
    id: number,
    bookMetadata?: GetBookMetadataResponsePayload,
): Promise<{ client: SqliteDatabase; cleanup: () => Promise<void> }> => {
    logger.info(`Setting up book database for ${id}`);

    const bookResponse: GetBookMetadataResponsePayload = bookMetadata || (await getBookMetadata(id));
    const patchEntriesPromise = bookResponse.minorReleaseUrl
        ? unzipFromUrl(bookResponse.minorReleaseUrl)
        : Promise.resolve<UnzippedEntry[]>([]);

    const [bookEntries, patchEntries] = await Promise.all([
        unzipFromUrl(bookResponse.majorReleaseUrl),
        patchEntriesPromise,
    ]);

    const bookEntry = findSqliteEntry(bookEntries);

    if (!bookEntry) {
        throw new Error('Unable to locate book database in archive');
    }

    const client = await createDatabase();

    try {
        logger.info(`Creating tables`);
        createBookTables(client);

        const sourceDatabase = await openDatabase(bookEntry.data);

        try {
            const patchEntry = findSqliteEntry(patchEntries);

            if (patchEntry) {
                logger.info(`Applying patches from ${patchEntry.name} to ${bookEntry.name}`);
                const patchDatabase = await openDatabase(patchEntry.data);

                try {
                    applyPatches(client, sourceDatabase, patchDatabase);
                } finally {
                    patchDatabase.close();
                }
            } else {
                logger.info(`Copying table data from ${bookEntry.name}`);
                copyTableData(client, sourceDatabase);
            }
        } finally {
            sourceDatabase.close();
        }

        const cleanup = async () => {
            client.close();
        };

        return { cleanup, client };
    } catch (error) {
        client.close();
        throw error;
    }
};

/**
 * Downloads, validates, and prepares the master SQLite database for use.
 *
 * This helper is responsible for retrieving the master archive, ensuring all
 * required tables are present, copying their contents into a fresh in-memory
 * database, and returning both the database instance and cleanup hook.
 *
 * @param masterMetadata - Optional pre-fetched metadata describing the master archive
 * @returns A promise resolving to the database client, cleanup function, and version number
 */
const setupMasterDatabase = async (
    masterMetadata?: GetMasterMetadataResponsePayload,
): Promise<{ client: SqliteDatabase; cleanup: () => Promise<void>; version: number }> => {
    logger.info('Setting up master database');

    const masterResponse = masterMetadata || (await getMasterMetadata(DEFAULT_MASTER_METADATA_VERSION));

    logger.info(`Downloading master database ${masterResponse.version} from: ${redactUrl(masterResponse.url)}`);
    const sourceTables = await unzipFromUrl(fixHttpsProtocol(masterResponse.url));

    logger.info(`sourceTables downloaded: ${sourceTables.map((table) => table.name).toString()}`);

    if (!validateMasterSourceTables(sourceTables.map((table) => table.name))) {
        logger.error(`Some source tables were not found: ${sourceTables.map((table) => table.name).toString()}`);
        throw new Error('Expected tables not found!');
    }

    const client = await createDatabase();

    try {
        logger.info('Creating master tables');
        createMasterTables(client);

        logger.info('Copying data to master table');
        await copyForeignMasterTableData(client, sourceTables.filter(isSqliteEntry));

        const cleanup = async () => {
            client.close();
        };

        return { cleanup, client, version: masterResponse.version };
    } catch (error) {
        client.close();
        throw error;
    }
};

/**
 * Retrieves metadata for a specific book from the Shamela API.
 *
 * This function fetches book release information including major and minor release
 * URLs and version numbers from the Shamela web service.
 *
 * @param id - The unique identifier of the book to fetch metadata for
 * @param options - Optional parameters for specifying major and minor versions
 * @returns A promise that resolves to book metadata including release URLs and versions
 *
 * @throws {Error} When environment variables are not set or API request fails
 *
 * @example
 * ```typescript
 * const metadata = await getBookMetadata(123, { majorVersion: 1, minorVersion: 2 });
 * console.log(metadata.majorReleaseUrl); // Download URL for the book
 * ```
 */
export const getBookMetadata = async (
    id: number,
    options?: GetBookMetadataOptions,
): Promise<GetBookMetadataResponsePayload> => {
    validateEnvVariables();

    const booksEndpoint = requireConfigValue('booksEndpoint');
    const url = buildUrl(`${booksEndpoint}/${id}`, {
        major_release: (options?.majorVersion || 0).toString(),
        minor_release: (options?.minorVersion || 0).toString(),
    });

    logger.info(`Fetching shamela.ws book link: ${redactUrl(url)}`);

    try {
        const response = (await httpsGet(url)) as BookUpdatesResponse;
        return {
            majorRelease: response.major_release,
            majorReleaseUrl: fixHttpsProtocol(response.major_release_url),
            ...(response.minor_release_url && { minorReleaseUrl: fixHttpsProtocol(response.minor_release_url) }),
            ...(response.minor_release_url && { minorRelease: response.minor_release }),
        };
    } catch (error: any) {
        throw new Error(`Error fetching book metadata: ${error.message}`);
    }
};

/**
 * Downloads and processes a book from the Shamela database.
 *
 * This function downloads the book's database files, applies patches if available,
 * creates the necessary database tables, and exports the data to the specified format.
 * The output can be either a JSON file or a SQLite database file.
 *
 * @param id - The unique identifier of the book to download
 * @param options - Configuration options including output file path and optional book metadata
 * @returns A promise that resolves to the path of the created output file
 *
 * @throws {Error} When download fails, database operations fail, or file operations fail
 *
 * @example
 * ```typescript
 * // Download as JSON
 * const jsonPath = await downloadBook(123, {
 *   outputFile: { path: './book.json' }
 * });
 *
 * // Download as SQLite database
 * const dbPath = await downloadBook(123, {
 *   outputFile: { path: './book.db' }
 * });
 * ```
 */
export const downloadBook = async (id: number, options: DownloadBookOptions): Promise<string> => {
    logger.info(`downloadBook ${id} ${JSON.stringify(options)}`);

    if (!options.outputFile.path) {
        throw new Error('outputFile.path must be provided to determine output format');
    }

    const extension = getExtension(options.outputFile.path);

    const { client, cleanup } = await setupBookDatabase(id, options?.bookMetadata);

    try {
        if (extension === '.json') {
            const result = await getBookData(client);
            await writeOutput(options.outputFile, JSON.stringify(result, null, 2));
        } else if (extension === '.db' || extension === '.sqlite') {
            const payload = client.export();
            await writeOutput(options.outputFile, payload);
        } else {
            throw new Error(`Unsupported output extension: ${extension}`);
        }
    } finally {
        await cleanup();
    }

    return options.outputFile.path;
};

/**
 * Retrieves metadata for the master database from the Shamela API.
 *
 * The master database contains information about all books, authors, and categories
 * in the Shamela library. This function fetches the download URL and version
 * information for the master database patches.
 *
 * @param version - The version number to check for updates (defaults to 0)
 * @returns A promise that resolves to master database metadata including download URL and version
 *
 * @throws {Error} When environment variables are not set or API request fails
 *
 * @example
 * ```typescript
 * const masterMetadata = await getMasterMetadata(5);
 * console.log(masterMetadata.url); // URL to download master database patch
 * console.log(masterMetadata.version); // Latest version number
 * ```
 */
export const getMasterMetadata = async (version: number = 0): Promise<GetMasterMetadataResponsePayload> => {
    validateEnvVariables();

    const masterEndpoint = requireConfigValue('masterPatchEndpoint');
    const url = buildUrl(masterEndpoint, { version: version.toString() });

    logger.info(`Fetching shamela.ws master database patch link: ${redactUrl(url)}`);

    try {
        const response: Record<string, any> = await httpsGet(url);
        return { url: response.patch_url, version: response.version };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
    }
};

/**
 * Generates the URL for a book's cover image.
 *
 * This function constructs the URL to access the cover image for a specific book
 * using the book's ID and the API endpoint host.
 *
 * @param bookId - The unique identifier of the book
 * @returns The complete URL to the book's cover image
 *
 * @example
 * ```typescript
 * const coverUrl = getCoverUrl(123);
 * console.log(coverUrl); // "https://api.shamela.ws/covers/123.jpg"
 * ```
 */
export const getCoverUrl = (bookId: number) => {
    const masterEndpoint = requireConfigValue('masterPatchEndpoint');
    const { origin } = new URL(masterEndpoint);
    return `${origin}/covers/${bookId}.jpg`;
};

/**
 * Downloads and processes the master database from the Shamela service.
 *
 * The master database contains comprehensive information about all books, authors,
 * and categories available in the Shamela library. This function downloads the
 * database files, creates the necessary tables, and exports the data in the
 * specified format (JSON or SQLite).
 *
 * @param options - Configuration options including output file path and optional master metadata
 * @returns A promise that resolves to the path of the created output file
 *
 * @throws {Error} When download fails, expected tables are missing, database operations fail, or file operations fail
 *
 * @example
 * ```typescript
 * // Download master database as JSON
 * const jsonPath = await downloadMasterDatabase({
 *   outputFile: { path: './master.json' }
 * });
 *
 * // Download master database as SQLite
 * const dbPath = await downloadMasterDatabase({
 *   outputFile: { path: './master.db' }
 * });
 * ```
 */
export const downloadMasterDatabase = async (options: DownloadMasterOptions): Promise<string> => {
    logger.info(`downloadMasterDatabase ${JSON.stringify(options)}`);

    if (!options.outputFile.path) {
        throw new Error('outputFile.path must be provided to determine output format');
    }

    const extension = getExtension(options.outputFile.path);
    const { client, cleanup, version } = await setupMasterDatabase(options.masterMetadata);

    try {
        if (extension === '.json') {
            const result = getMasterData(client, version);
            await writeOutput(options.outputFile, JSON.stringify(result, null, 2));
        } else if (extension === '.db' || extension === '.sqlite') {
            await writeOutput(options.outputFile, client.export());
        } else {
            throw new Error(`Unsupported output extension: ${extension}`);
        }
    } finally {
        await cleanup();
    }

    return options.outputFile.path;
};

/**
 * Retrieves complete book data including pages and titles.
 *
 * This is a convenience function that downloads a book's data and returns it
 * as a structured JavaScript object. The function handles the temporary file
 * creation and cleanup automatically.
 *
 * @param id - The unique identifier of the book to retrieve
 * @returns A promise that resolves to the complete book data including pages and titles
 *
 * @throws {Error} When download fails, file operations fail, or JSON parsing fails
 *
 * @example
 * ```typescript
 * const bookData = await getBook(123);
 * console.log(bookData.pages.length); // Number of pages in the book
 * console.log(bookData.titles?.length); // Number of title entries
 * ```
 */
export const getBook = async (id: number): Promise<BookData> => {
    logger.info(`getBook ${id}`);

    const { client, cleanup } = await setupBookDatabase(id);

    try {
        const data = await getBookData(client);

        const result: BookData = {
            pages: data.pages.map(mapPageRowToPage),
            titles: data.titles.map(mapTitleRowToTitle),
        };

        return result;
    } finally {
        await cleanup();
    }
};

/**
 * Retrieves complete master data including authors, books, and categories.
 *
 * This convenience function downloads the master database archive, builds an in-memory
 * SQLite database, and returns structured data for immediate consumption alongside
 * the version number of the snapshot.
 *
 * @returns A promise that resolves to the complete master dataset and its version
 */
export const getMaster = async (): Promise<MasterData> => {
    logger.info('getMaster');

    const { client, cleanup, version } = await setupMasterDatabase();

    try {
        return getMasterData(client, version);
    } finally {
        await cleanup();
    }
};
