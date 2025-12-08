import { defineConfig } from 'tsdown';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts', 'src/content.ts', 'src/types.ts', 'src/utils/constants.ts'],
    external: ['node:fs/promises', 'node:os', 'node:path'],
    format: ['esm'],
    loader: {
        '.wasm': 'asset',
    },
    minify: true,
    platform: 'neutral',
    sourcemap: true,
    target: 'esnext',
});
