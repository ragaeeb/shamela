# Agent Guide

## Development

- Use `bun install` (already run) to manage dependencies and prefer `bun test` for unit coverage.
- Run `bun run build` before committing to ensure the library compiles with `tsdown`.
- Use Biome for formatting and linting (`bunx biome format --write` / `bunx biome check`). The config lives in `biome.json`.
- Tests live beside the source files under `src/` and in the `testing/` directory for E2E checks.
- Prefer writing unit tests with Bun's built-in test runner (`bun:test`).
- Documentation resides in `README.md`; update it when adding or modifying public APIs.
- Keep the repository side-effect free—temporary files should go under `/tmp` or be cleaned up after use.

## Package Exports

The library uses conditional exports for browser/Node.js compatibility:

| Export | Entry Point | Description |
|--------|-------------|-------------|
| `shamela` | `src/index.ts` | Full API including sql.js (Node.js/server-side) |
| `shamela/content` | `src/content.ts` | Content utilities only, browser-safe (~1.5KB gzipped) |
| `shamela/types` | `src/types.ts` | Type definitions only |

### Adding New Exports

1. Create entry point in `src/` (e.g., `src/newmodule.ts`)
2. Add to `tsdown.config.ts` entry array
3. Add to `package.json` exports field with `types`, `import`, and `default` conditions
4. Run `bun run build` to verify

### Browser Compatibility

- `src/content.ts` must NOT import from `./api`, `./db/`, or `./config` (these pull in sql.js)
- Content utilities should be pure JavaScript string processing
- When adding new utilities, consider if they belong in `content.ts` (browser-safe) or `index.ts` (full API)
