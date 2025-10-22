import { defineConfig } from 'tsdown';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    external: ['node:fs/promises', 'node:path'],
    format: ['esm'],
    loader: {
        '.wasm': 'asset',
    },
    minify: true,
    platform: 'neutral',
    sourcemap: true,
    target: 'esnext',
});
