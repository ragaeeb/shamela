import { unzip } from 'fflate';

import type { OutputOptions } from '@/types';
import { httpsGet } from './network';

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
    const binary = await httpsGet<Uint8Array>(url);

    return new Promise((resolve, reject) => {
        unzip(binary, (error, result) => {
            if (error) {
                reject(new Error(`Error processing URL: ${error.message}`));
                return;
            }

            const entries = Object.entries(result).map(([name, data]) => ({ name, data }));
            resolve(entries);
        });
    });
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
