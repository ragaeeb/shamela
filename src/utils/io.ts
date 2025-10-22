import { unzipSync } from 'fflate';

import type { OutputOptions } from '@/types';
import { httpsGet } from './network';
import logger from './logger';

export type UnzippedEntry = { name: string; data: Uint8Array };

const isNodeEnvironment = typeof process !== 'undefined' && Boolean(process?.versions?.node);

const ensureNodeFs = async () => {
    if (!isNodeEnvironment) {
        throw new Error('File system operations are only supported in Node.js environments');
    }

    return import('node:fs/promises');
};

const ensureDirectory = async (filePath: string) => {
    const [fs, path] = await Promise.all([ensureNodeFs(), import('node:path')]);
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    return fs;
};

export const unzipFromUrl = async (url: string): Promise<UnzippedEntry[]> => {
    logger.debug('unzipFromUrl:url', url);
    const binary = await httpsGet<Uint8Array>(url);
    const byteLength =
        binary instanceof Uint8Array
            ? binary.length
            : binary && typeof (binary as ArrayBufferLike).byteLength === 'number'
              ? (binary as ArrayBufferLike).byteLength
              : 0;
    logger.debug('unzipFromUrl:bytes', byteLength);

    return new Promise((resolve, reject) => {
        const dataToUnzip = binary instanceof Uint8Array ? binary : new Uint8Array(binary as ArrayBufferLike);

        try {
            const result = unzipSync(dataToUnzip);
            const entries = Object.entries(result).map(([name, data]) => ({ data, name }));
            logger.debug('unzipFromUrl:entries', entries.map((entry) => entry.name));
            resolve(entries);
        } catch (error: any) {
            reject(new Error(`Error processing URL: ${error.message}`));
        }
    });
};

export const createTempDir = async (prefix = 'shamela') => {
    const [fs, os, path] = await Promise.all([ensureNodeFs(), import('node:os'), import('node:path')]);
    const base = path.join(os.tmpdir(), prefix);
    return fs.mkdtemp(base);
};

export const writeOutput = async (output: OutputOptions, payload: string | Uint8Array) => {
    if (output.writer) {
        await output.writer(payload);
        return;
    }

    if (!output.path) {
        throw new Error('Output options must include either a writer or a path');
    }

    const fs = await ensureDirectory(output.path);

    if (typeof payload === 'string') {
        await fs.writeFile(output.path, payload, 'utf-8');
    } else {
        await fs.writeFile(output.path, payload);
    }
};
