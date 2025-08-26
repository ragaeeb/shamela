import { describe, expect, it } from 'bun:test';
import { promises as fs } from 'fs';

import { createTempDir, unzipFromUrl } from './io';

describe('io', () => {
    describe('unzipFromUrl', () => {
        it('should unzip the remote zip file into the folder', async () => {
            const tempDir = await createTempDir('shamela_io_test');

            try {
                const files = await unzipFromUrl(
                    'https://thetestdata.com/samplefiles/zip/Thetestdata_ZIP_5KB.zip',
                    tempDir,
                );

                expect(files).toHaveLength(10);
            } finally {
                await fs.rm(tempDir, { recursive: true });
            }
        }, 20000);
    });
});
