import logger from './utils/logger.js';
import { httpsGet } from './utils/network.js'; // Assume the utility is in a file called httpsGet.ts
import { Client, createClient } from '@libsql/client';
import path from 'path';
import process from 'process';
import { URL, URLSearchParams } from 'url';

import { applyPatches, createTables as createBookTables } from './db/book.js';
import { copyForeignMasterTableData, createTables as createMasterTables } from './db/master.js';
import {
    DownloadBookOptions,
    DownloadMasterOptions,
    GetBookMetadataOptions,
    GetBookMetadataResponsePayload,
    GetMasterMetadataResponsePayload,
} from './types.js';
import { DEFAULT_MASTER_METADATA_VERSION } from './utils/constants.js';
import { unzipFromUrl } from './utils/io.js';
import { validateEnvVariables, validateMasterSourceTables } from './utils/validation.js';

export const getMasterMetadata = async (version: number = 0): Promise<GetMasterMetadataResponsePayload> => {
    validateEnvVariables();

    const url = new URL(process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT as string);
    {
        const params = new URLSearchParams();
        params.append('api_key', process.env.SHAMELA_API_KEY as string);
        params.append('version', version.toString());
        url.search = params.toString();
    }

    logger.info(`Fetching shamela.ws master database patch link: ${url.toString()}`);

    try {
        const response: Record<string, any> = await httpsGet(url);
        return { url: response.patch_url, version: response.version };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
    }
};

export const downloadMasterDatabase = async (options: DownloadMasterOptions): Promise<string> => {
    logger.info(`downloadMasterDatabase ${JSON.stringify(options)}`);

    const { dir: folder } = path.parse(options.outputFile.path);

    const masterResponse: GetMasterMetadataResponsePayload =
        options.masterMetadata || (await getMasterMetadata(DEFAULT_MASTER_METADATA_VERSION));

    logger.info(`Downloading master database from: ${JSON.stringify(masterResponse)}`);
    const sourceTables: string[] = await unzipFromUrl(masterResponse.url, folder);

    logger.info(`sourceTables downloaded: ${sourceTables.toString()}`);

    if (!validateMasterSourceTables(sourceTables)) {
        logger.error(`Some source tables were not found: ${sourceTables.toString()}`);
        throw new Error('Expected tables not found!');
    }

    const client: Client = createClient({
        url: `file:${options.outputFile.path}`,
    });

    try {
        logger.info(`Creating tables`);
        await createMasterTables(client);

        logger.info(`Copying data to master table`);
        await copyForeignMasterTableData(client, sourceTables);
    } finally {
        client.close();
    }

    return options.outputFile.path;
};

export const getBookMetadata = async (
    id: number,
    options?: GetBookMetadataOptions,
): Promise<GetBookMetadataResponsePayload> => {
    validateEnvVariables();

    const url = new URL(`${process.env.SHAMELA_API_BOOKS_ENDPOINT}/${id}`);
    {
        const params = new URLSearchParams();
        params.append('api_key', process.env.SHAMELA_API_KEY as string);
        params.append('major_release', (options?.majorVersion || 0).toString());
        params.append('minor_release', (options?.minorVersion || 0).toString());
        url.search = params.toString();
    }

    logger.info(`Fetching shamela.ws book link: ${url.toString()}`);

    try {
        const response: Record<string, any> = await httpsGet(url);
        return {
            majorRelease: response.major_release,
            majorReleaseUrl: response.major_release_url,
            ...(response.minor_release_url && { minorReleaseUrl: response.minor_release_url }),
            ...(response.minor_release_url && { minorRelease: response.minor_release }),
        };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
    }
};

export const downloadBook = async (id: number, options: DownloadBookOptions): Promise<string> => {
    logger.info(`downloadBook ${id} ${JSON.stringify(options)}`);

    const { dir: folder } = path.parse(options.outputFile.path);

    const bookResponse: GetBookMetadataResponsePayload = options?.bookMetadata || (await getBookMetadata(id));
    const [[bookDatabase], [patchDatabase]]: string[][] = await Promise.all([
        unzipFromUrl(bookResponse.majorReleaseUrl, folder),
        ...(bookResponse.minorReleaseUrl ? [unzipFromUrl(bookResponse.minorReleaseUrl, folder)] : []),
    ]);

    const client: Client = createClient({
        url: `file:${options.outputFile.path}`,
    });

    try {
        logger.info(`Creating tables`);
        await createBookTables(client);

        logger.info(`Applying patches from ${patchDatabase} to ${bookDatabase}`);
        await applyPatches(client, bookDatabase, patchDatabase);
    } finally {
        client.close();
    }

    return options.outputFile.path;
};
