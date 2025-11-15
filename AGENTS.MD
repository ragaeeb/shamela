# Agent Guide

- Use `bun install` (already run) to manage dependencies and prefer `bun test` for unit coverage.
- Run `bun run build` before committing to ensure the library compiles with `tsdown`.
- Use Biome for formatting and linting (`bunx biome format --write` / `bunx biome check`). The config lives in `biome.json`.
- Tests live beside the source files under `src/` and in the `testing/` directory for E2E checks.
- Prefer writing unit tests with Bun's built-in test runner (`bun:test`).
- Documentation resides in `README.md`; update it when adding or modifying public APIs.
- Keep the repository side-effect free—temporary files should go under `/tmp` or be cleaned up after use.
