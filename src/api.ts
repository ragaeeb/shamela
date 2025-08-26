import { Database } from 'bun:sqlite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

import { applyPatches, copyTableData, createTables as createBookTables, getData as getBookData } from './db/book.js';
import {
    copyForeignMasterTableData,
    createTables as createMasterTables,
    getData as getMasterData,
} from './db/master.js';
import {
    BookData,
    DownloadBookOptions,
    DownloadMasterOptions,
    GetBookMetadataOptions,
    GetBookMetadataResponsePayload,
    GetMasterMetadataResponsePayload,
} from './types.js';
import { DEFAULT_MASTER_METADATA_VERSION } from './utils/constants.js';
import { createTempDir, unzipFromUrl } from './utils/io.js';
import logger from './utils/logger.js';
import { buildUrl, httpsGet } from './utils/network.js';
import { validateEnvVariables, validateMasterSourceTables } from './utils/validation.js';

const fixHttpsProtocol = (originalUrl: string) => {
    const url = new URL(originalUrl);
    url.protocol = 'https';

    return url.toString();
};

type BookUpdatesResponse = {
    major_release: number;
    major_release_url: string;
    minor_release?: number;
    minor_release_url?: string;
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

    const url = buildUrl(`${process.env.SHAMELA_API_BOOKS_ENDPOINT}/${id}`, {
        major_release: (options?.majorVersion || 0).toString(),
        minor_release: (options?.minorVersion || 0).toString(),
    });

    logger.info(`Fetching shamela.ws book link: ${url.toString()}`);

    try {
        const response = (await httpsGet(url)) as BookUpdatesResponse;
        return {
            majorRelease: response.major_release,
            majorReleaseUrl: fixHttpsProtocol(response.major_release_url),
            ...(response.minor_release_url && { minorReleaseUrl: fixHttpsProtocol(response.minor_release_url) }),
            ...(response.minor_release_url && { minorRelease: response.minor_release }),
        };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
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

    const outputDir = await createTempDir('shamela_downloadBook');

    const bookResponse: GetBookMetadataResponsePayload = options?.bookMetadata || (await getBookMetadata(id));
    const [[bookDatabase], [patchDatabase] = []]: string[][] = await Promise.all([
        unzipFromUrl(bookResponse.majorReleaseUrl, outputDir),
        ...(bookResponse.minorReleaseUrl ? [unzipFromUrl(bookResponse.minorReleaseUrl, outputDir)] : []),
    ]);
    const dbPath = path.join(outputDir, 'book.db');

    const client = new Database(dbPath);

    try {
        logger.info(`Creating tables`);
        await createBookTables(client);

        if (patchDatabase) {
            logger.info(`Applying patches from ${patchDatabase} to ${bookDatabase}`);
            await applyPatches(client, bookDatabase, patchDatabase);
        } else {
            logger.info(`Copying table data from ${bookDatabase}`);
            await copyTableData(client, bookDatabase);
        }

        const { ext: extension } = path.parse(options.outputFile.path);

        if (extension === '.json') {
            const result = await getBookData(client);
            await fs.writeFile(options.outputFile.path, JSON.stringify(result, undefined, 2), 'utf8');
        }

        client.close();

        if (extension === '.db' || extension === '.sqlite') {
            await fs.rename(dbPath, options.outputFile.path);
        }

        await fs.rm(outputDir, { recursive: true });
    } finally {
        client.close();
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

    const url = buildUrl(process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT as string, { version: version.toString() });

    logger.info(`Fetching shamela.ws master database patch link: ${url.toString()}`);

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
    const { host } = new URL(process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT!);
    return `${host}/covers/${bookId}.jpg`;
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

    const outputDir = await createTempDir('shamela_downloadMaster');

    const masterResponse: GetMasterMetadataResponsePayload =
        options.masterMetadata || (await getMasterMetadata(DEFAULT_MASTER_METADATA_VERSION));

    logger.info(`Downloading master database from: ${JSON.stringify(masterResponse)}`);
    const sourceTables: string[] = await unzipFromUrl(fixHttpsProtocol(masterResponse.url), outputDir);

    logger.info(`sourceTables downloaded: ${sourceTables.toString()}`);

    if (!validateMasterSourceTables(sourceTables)) {
        logger.error(`Some source tables were not found: ${sourceTables.toString()}`);
        throw new Error('Expected tables not found!');
    }

    const dbPath = path.join(outputDir, 'master.db');

    const client = new Database(dbPath);

    try {
        logger.info(`Creating tables`);
        await createMasterTables(client);

        logger.info(`Copying data to master table`);
        await copyForeignMasterTableData(client, sourceTables);

        const { ext: extension } = path.parse(options.outputFile.path);

        if (extension === '.json') {
            const result = await getMasterData(client);
            await Bun.file(options.outputFile.path).write(JSON.stringify(result, null, 2));
        }

        client.close();

        if (extension === '.db' || extension === '.sqlite') {
            await fs.rename(dbPath, options.outputFile.path);
        }

        await fs.rm(outputDir, { recursive: true });
    } finally {
        client.close();
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
    const outputDir = await createTempDir('shamela_getBookData');
    const outputPath = await downloadBook(id, { outputFile: { path: path.join(outputDir, `${id}.json`) } });

    const data: BookData = await Bun.file(outputPath).json();
    await fs.rm(outputDir, { recursive: true });

    return data;
};
