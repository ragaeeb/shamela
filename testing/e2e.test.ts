import { describe, expect, it } from 'vitest';

import { downloadMasterVersion } from '../src/utils/api';
import { createTempDir } from '../src/utils/io';

describe('e2e', () => {
    describe('downloadMasterVersion', () => {
        it('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const outputDir = await createTempDir();

            const result = await downloadMasterVersion({ outputDirectory: { path: outputDir } });
            expect(result).toHaveLength(3);
        });
    });
});
