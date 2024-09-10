import { promises as fs, createWriteStream } from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
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
    return new Promise((resolve, reject) => {
        try {
            const extractedFiles: string[] = [];

            // Make HTTPS request to download and stream the ZIP file
            https
                .get(url, (response) => {
                    if (response.statusCode !== 200) {
                        return reject(
                            new Error(`Failed to download ZIP file: ${response.statusCode} ${response.statusMessage}`),
                        );
                    }

                    response
                        .pipe(unzipper.Parse())
                        .on('entry', async (entry: Entry) => {
                            const filePath = path.join(outputDir, entry.path);

                            if (entry.type === 'Directory') {
                                await fs.mkdir(filePath, { recursive: true });
                                entry.autodrain(); // No need to extract directory content
                            } else {
                                extractedFiles.push(filePath);
                                entry.pipe(createWriteStream(filePath));
                            }
                        })
                        .on('close', () => {
                            resolve(extractedFiles); // Resolve with the list of extracted files
                        })
                        .on('error', (err) => {
                            reject(new Error(`Error during extraction: ${err.message}`));
                        });
                })
                .on('error', (err) => {
                    reject(new Error(`HTTPS request failed: ${err.message}`));
                });
        } catch (error: any) {
            reject(new Error(`Error processing URL: ${error.message}`));
        }
    });
}
