import { zipSync } from 'fflate';
import { describe, expect, it, mock } from 'bun:test';

const zippedData = zipSync({ 'hello.txt': new TextEncoder().encode('hello world') });

const httpsGetMock = mock(async () => new Uint8Array(zippedData));

mock.module('./network', () => ({
    httpsGet: httpsGetMock,
}));

import { unzipFromUrl } from './io';

describe('io utilities', () => {
    it('unzipFromUrl downloads and extracts entries', async () => {
        const entries = await unzipFromUrl('https://example.com/file.zip');
        expect(entries).toEqual([
            { data: expect.any(Uint8Array), name: 'hello.txt' },
        ]);
        expect(new TextDecoder().decode(entries[0].data)).toBe('hello world');
        expect(httpsGetMock).toHaveBeenCalledWith('https://example.com/file.zip');
    });
});
