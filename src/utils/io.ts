import { createWriteStream, promises as fs } from 'fs';
import { IncomingMessage } from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import unzipper, { Entry } from 'unzipper';

export const createTempDir = async (prefix = 'shamela') => {
    const tempDirBase = path.join(os.tmpdir(), prefix);
    return fs.mkdtemp(tempDirBase);
};

export const fileExists = async (path: string) => !!(await fs.stat(path).catch(() => false));

/**
 * Downloads and extracts a ZIP file from a given URL without loading the entire file into memory.
 *
 * @param url - The URL of the ZIP file to download and extract.
 * @param outputDir - The directory where the files should be extracted.
 * @returns A promise that resolves with the list of all extracted files.
 */
export async function unzipFromUrl(url: string, outputDir: string): Promise<string[]> {
    const extractedFiles: string[] = [];
    const entryPromises: Promise<void>[] = [];

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

        // Create unzip stream
        const unzipStream = unzipper.Parse();

        // Handle entries in the ZIP file
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

                    // Pipe the entry to a file
                    await pipeline(entry, createWriteStream(filePath));
                    extractedFiles.push(filePath);
                }
            })().catch((err) => {
                // Emit errors to be handled by the unzipStream error handler
                unzipStream.emit('error', err);
            });

            // Collect the promises
            entryPromises.push(entryPromise);
        });

        // Handle errors in the unzip stream
        unzipStream.on('error', (err) => {
            throw new Error(`Error during extraction: ${err.message}`);
        });

        // Pipe the response into the unzip stream
        await pipeline(response, unzipStream);

        // Wait for all entry promises to complete
        await Promise.all(entryPromises);

        return extractedFiles;
    } catch (error: any) {
        throw new Error(`Error processing URL: ${error.message}`);
    }
}
