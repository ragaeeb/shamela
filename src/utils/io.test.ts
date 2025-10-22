import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { unzipFromUrl } from './io';

const zippedData = zipSync({ 'hello.txt': new TextEncoder().encode('hello world') });
const networkModule = await import('./network.ts');

describe('io utilities', () => {
    let httpsGetSpy: ReturnType<typeof spyOn<typeof networkModule, 'httpsGet'>>;

    beforeEach(() => {
        httpsGetSpy = spyOn(networkModule, 'httpsGet').mockResolvedValue(
            new Uint8Array(zippedData) as unknown as Awaited<ReturnType<typeof networkModule.httpsGet>>,
        );
    });

    afterEach(() => {
        httpsGetSpy.mockRestore();
    });

    it('unzipFromUrl downloads and extracts entries', async () => {
        const entries = await unzipFromUrl('https://example.com/file.zip');
        expect(entries).toEqual([{ data: expect.any(Uint8Array), name: 'hello.txt' }]);
        expect(new TextDecoder().decode(entries[0].data)).toBe('hello world');
        expect(httpsGetSpy).toHaveBeenCalledWith('https://example.com/file.zip');
    });
});
