import logger from './logger.js';
import { httpsGet } from './network'; // Assume the utility is in a file called httpsGet.ts
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { URL, URLSearchParams } from 'url';

import { DownloadMasterOptions, GetMasterMetadataResponsePayload } from '../types.js';
import { unzipFromUrl } from './io.js';
import { validateMasterSourceTables } from './validation.js';

export const getMasterMetadata = async (version: number = 0): Promise<GetMasterMetadataResponsePayload> => {
    if (!process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT) {
        throw new Error('SHAMELA_API_MASTER_PATCH_ENDPOINT environment variable not set');
    }

    if (!process.env.SHAMELA_API_KEY) {
        throw new Error('SHAMELA_API_KEY environment variable not set');
    }

    const url = new URL(process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT);
    {
        const params = new URLSearchParams();
        params.append('api_key', process.env.SHAMELA_API_KEY);
        params.append('version', version.toString());
        url.search = params.toString();
    }

    logger.info(`Fetching shamela.ws master database patch link: ${url.toString()}`);

    try {
        const response: Record<string, any> = await httpsGet(url.toString());
        return { url: response.patch_url, version: response.version };
    } catch (error: any) {
        throw new Error(`Error fetching master patch: ${error.message}`);
    }
};

const downloadMaster = async (url: string, options: DownloadMasterOptions): Promise<string[]> => {
    const sourceTables: string[] = await unzipFromUrl(url, options.outputDirectory.path);

    if (!validateMasterSourceTables(sourceTables)) {
        logger.error(`Some source tables were not found: ${sourceTables.toString()}`);
        throw new Error('Expected tables not found!');
    }

    return sourceTables;
};

export const downloadMasterVersion = async (options: DownloadMasterOptions, version: number = 0): Promise<string[]> => {
    const masterResponse: GetMasterMetadataResponsePayload = await getMasterMetadata(version);
    const result = await downloadMaster(masterResponse.url, options);

    return result;
};
