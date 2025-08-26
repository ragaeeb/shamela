import { defineConfig } from 'tsup';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    external: ['bun:sqlite'],
    format: ['esm'],
    minify: true,
    platform: 'neutral',
    sourcemap: true,
    target: 'esnext',
});
