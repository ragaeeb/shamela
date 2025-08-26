import { Buffer } from 'node:buffer';
import { IncomingMessage } from 'node:http';
import https from 'node:https';
import process from 'node:process';
import { URL, URLSearchParams } from 'node:url';

/**
 * Builds a URL with query parameters and optional authentication.
 * @param {string} endpoint - The base endpoint URL
 * @param {Record<string, any>} queryParams - Object containing query parameters to append
 * @param {boolean} [useAuth=true] - Whether to include the API key from environment variables
 * @returns {URL} The constructed URL object with query parameters
 */
export const buildUrl = (endpoint: string, queryParams: Record<string, any>, useAuth: boolean = true): URL => {
    const url = new URL(endpoint);
    {
        const params = new URLSearchParams();

        Object.entries(queryParams).forEach(([key, value]) => {
            params.append(key, value.toString());
        });

        if (useAuth) {
            params.append('api_key', process.env.SHAMELA_API_KEY!);
        }

        url.search = params.toString();
    }

    return url;
};

/**
 * Makes an HTTPS GET request and returns the response data.
 * @template T - The expected return type (Buffer or Record<string, any>)
 * @param {string | URL} url - The URL to make the request to
 * @returns {Promise<T>} A promise that resolves to the response data, parsed as JSON if content-type is application/json, otherwise as Buffer
 * @throws {Error} When the request fails or JSON parsing fails
 */
export const httpsGet = <T extends Buffer | Record<string, any>>(url: string | URL): Promise<T> => {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res: IncomingMessage) => {
                const contentType = res.headers['content-type'] || '';
                const dataChunks: Buffer[] = [];

                res.on('data', (chunk: Buffer) => {
                    dataChunks.push(chunk);
                });

                res.on('end', () => {
                    const fullData = Buffer.concat(dataChunks);

                    if (contentType.includes('application/json')) {
                        try {
                            const json = JSON.parse(fullData.toString('utf-8'));
                            resolve(json);
                        } catch (error: any) {
                            reject(new Error(`Failed to parse JSON: ${error.message}`));
                        }
                    } else {
                        resolve(fullData as T);
                    }
                });
            })
            .on('error', (error) => {
                reject(new Error(`Error making request: ${error.message}`));
            });
    });
};
