import { Buffer } from 'buffer';
import { IncomingMessage } from 'http';
import https from 'https';
import { URL } from 'url';

export const httpsGet = (url: string | URL): Promise<Buffer | Record<string, any>> => {
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
                        resolve(fullData);
                    }
                });
            })
            .on('error', (error) => {
                reject(new Error(`Error making request: ${error.message}`));
            });
    });
};
