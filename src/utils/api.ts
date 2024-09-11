import logger from './logger.js';
import { httpsGet } from './network'; // Assume the utility is in a file called httpsGet.ts
import process from 'process';
import { URL, URLSearchParams } from 'url';

import {
    DownloadBookOptions,
    DownloadMasterOptions,
    GetBookMetadataOptions,
    GetBookMetadataResponsePayload,
    GetMasterMetadataResponsePayload,
} from '../types.js';
import { DEFAULT_MASTER_METADATA_VERSION } from './constants.js';
import { unzipFromUrl } from './io.js';
import { validateEnvVariables, validateMasterSourceTables } from './validation.js';

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

export const downloadMasterDatabase = async (options: DownloadMasterOptions): Promise<string[]> => {
    logger.info(`downloadMasterDatabase ${JSON.stringify(options)}`);

    const masterResponse: GetMasterMetadataResponsePayload =
        options.masterMetadata || (await getMasterMetadata(DEFAULT_MASTER_METADATA_VERSION));
    const sourceTables: string[] = await unzipFromUrl(masterResponse.url, options.outputDirectory.path);

    if (!validateMasterSourceTables(sourceTables)) {
        logger.error(`Some source tables were not found: ${sourceTables.toString()}`);
        throw new Error('Expected tables not found!');
    }

    return sourceTables;
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
            majorReleaseUrl: response.major_release_url,
            majorRelease: response.major_release,
            ...(response.minor_release_url && { minorReleaseUrl: response.minor_release_url }),
            ...(response.minor_release_url && { minorRelease: response.minor_release }),
        };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
    }
};

export const downloadBook = async (id: number, options: DownloadBookOptions) => {
    logger.info(`downloadBook ${id} ${JSON.stringify(options)}`);

    const bookResponse: GetBookMetadataResponsePayload = options?.bookMetadata || (await getBookMetadata(id));
    const [bookDatabase, patchDatabase]: string[] = await Promise.all([
        unzipFromUrl(bookResponse.majorReleaseUrl, options.outputFile.path),
        ...(bookResponse.minorReleaseUrl ? [unzipFromUrl(bookResponse.minorReleaseUrl, options.outputFile.path)] : []),
    ]);

    return sourceTables;
};
