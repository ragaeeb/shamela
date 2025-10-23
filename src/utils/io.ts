import { unzipSync } from 'fflate';

import type { OutputOptions } from '@/types';
import logger from './logger';
import { httpsGet } from './network';

/**
 * Representation of an extracted archive entry containing raw bytes and filename metadata.
 */
export type UnzippedEntry = { name: string; data: Uint8Array };

const isNodeEnvironment = typeof process !== 'undefined' && Boolean(process?.versions?.node);

/**
 * Dynamically imports the Node.js fs/promises module, ensuring the runtime supports file operations.
 *
 * @throws {Error} When executed in a non-Node.js environment
 * @returns The fs/promises module when available
 */
const ensureNodeFs = async () => {
    if (!isNodeEnvironment) {
        throw new Error('File system operations are only supported in Node.js environments');
    }

    return import('node:fs/promises');
};

/**
 * Ensures the directory for a file path exists, creating parent folders as needed.
 *
 * @param filePath - The target file path whose directory should be created
 * @returns The fs/promises module instance
 */
const ensureDirectory = async (filePath: string) => {
    const [fs, path] = await Promise.all([ensureNodeFs(), import('node:path')]);
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    return fs;
};

/**
 * Downloads a ZIP archive from the given URL and returns its extracted entries.
 *
 * @param url - The remote URL referencing a ZIP archive
 * @returns A promise resolving to the extracted archive entries
 */
export const unzipFromUrl = async (url: string): Promise<UnzippedEntry[]> => {
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
            logger.debug(
                'unzipFromUrl:entries',
                entries.map((entry) => entry.name),
            );
            resolve(entries);
        } catch (error: any) {
            reject(new Error(`Error processing URL: ${error.message}`));
        }
    });
};

/**
 * Creates a unique temporary directory with the provided prefix.
 *
 * @param prefix - Optional prefix for the generated directory name
 * @returns The created temporary directory path
 */
export const createTempDir = async (prefix = 'shamela') => {
    const [fs, os, path] = await Promise.all([ensureNodeFs(), import('node:os'), import('node:path')]);
    const base = path.join(os.tmpdir(), prefix);
    return fs.mkdtemp(base);
};

/**
 * Writes output data either using a provided writer function or to a file path.
 *
 * @param output - The configured output destination or writer
 * @param payload - The payload to persist (string or binary)
 * @throws {Error} When neither a writer nor file path is provided
 */
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
