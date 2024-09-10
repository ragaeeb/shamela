import { promises as fs } from 'fs';
import { describe, expect, it } from 'vitest';

import { unzipFromUrl } from './io';

describe('io', () => {
    describe('unzipFromUrl', () => {
        it('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const tempDir = await fs.mkdtemp('shamela_tests');
            const files = await unzipFromUrl(
                'https://thetestdata.com/samplefiles/zip/Thetestdata_ZIP_5KB.zip',
                tempDir,
            );

            expect(files).toHaveLength(10);
        });
    });
});
