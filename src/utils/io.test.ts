import { describe, expect, it } from 'vitest';

import { createTempDir, unzipFromUrl } from './io';

describe('io', () => {
    describe('unzipFromUrl', () => {
        it.only('should unzip the remote zip file into the folder', async () => {
            const tempDir = await createTempDir('shamela_io_test');
            const files = await unzipFromUrl(
                'https://thetestdata.com/samplefiles/zip/Thetestdata_ZIP_5KB.zip',
                tempDir,
            );

            expect(files).toHaveLength(10);
        });
    });
});
