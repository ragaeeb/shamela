import { createWriteStream, promises as fs } from 'node:fs';
import { IncomingMessage } from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper, { Entry } from 'unzipper';

/**
 * Creates a temporary directory with an optional prefix.
 * @param {string} [prefix='shamela'] - The prefix to use for the temporary directory name
 * @returns {Promise<string>} A promise that resolves to the path of the created temporary directory
 */
export const createTempDir = async (prefix = 'shamela') => {
    const tempDirBase = path.join(os.tmpdir(), prefix);
    return fs.mkdtemp(tempDirBase);
};

/**
 * Checks if a file exists at the given path.
 * @param {string} path - The file path to check
 * @returns {Promise<boolean>} A promise that resolves to true if the file exists, false otherwise
 */
export const fileExists = async (filePath: string) => !!(await fs.stat(filePath).catch(() => false));

/**
 * Downloads and extracts a ZIP file from a given URL without loading the entire file into memory.
 * @param {string} url - The URL of the ZIP file to download and extract
 * @param {string} outputDir - The directory where the files should be extracted
 * @returns {Promise<string[]>} A promise that resolves with the list of all extracted file paths
 * @throws {Error} When the download fails, extraction fails, or other network/filesystem errors occur
 */
export async function unzipFromUrl(url: string, outputDir: string): Promise<string[]> {
    const extractedFiles: string[] = [];

    try {
        // Make HTTPS request and get the response stream
        const response = await new Promise<IncomingMessage>((resolve, reject) => {
            https
                .get(url, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Failed to download ZIP file: ${res.statusCode} ${res.statusMessage}`));
                    } else {
                        resolve(res);
                    }
                })
                .on('error', (err) => {
                    reject(new Error(`HTTPS request failed: ${err.message}`));
                });
        });

        // Process the ZIP file using unzipper.Extract with proper event handling
        await new Promise<void>((resolve, reject) => {
            const unzipStream = unzipper.Parse();
            const entryPromises: Promise<void>[] = [];

            unzipStream.on('entry', (entry: Entry) => {
                const entryPromise = (async () => {
                    const filePath = path.join(outputDir, entry.path);

                    if (entry.type === 'Directory') {
                        // Ensure the directory exists
                        await fs.mkdir(filePath, { recursive: true });
                        entry.autodrain();
                    } else {
                        // Ensure the parent directory exists
                        const dir = path.dirname(filePath);
                        await fs.mkdir(dir, { recursive: true });

                        // Create write stream and pipe entry to it
                        const writeStream = createWriteStream(filePath);
                        await pipeline(entry, writeStream);
                        extractedFiles.push(filePath);
                    }
                })();

                entryPromises.push(entryPromise);
            });

            unzipStream.on('finish', async () => {
                try {
                    // Wait for all entries to be processed
                    await Promise.all(entryPromises);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            unzipStream.on('error', (error) => {
                reject(new Error(`Error during extraction: ${error.message}`));
            });

            // Pipe the response to the unzip stream
            response.pipe(unzipStream);
        });

        return extractedFiles;
    } catch (error: any) {
        throw new Error(`Error processing URL: ${error.message}`);
    }
}
