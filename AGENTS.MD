# Agent Guide

## Project Overview

**shamela** is a universal TypeScript library for accessing and downloading Maktabah Shamela v4 APIs. The Shamela Library (المكتبة الشاملة) is a widely-used Arabic Islamic text library containing thousands of classical Islamic texts, hadith collections, tafsir, and scholarly biographies.

### Purpose & Intent

This library provides:

- **Full data lifecycle** – Fetch metadata, download master and book databases, and query the results entirely in-memory using sql.js
- **Runtime configuration** – Configure API credentials, WASM paths, and custom fetch/logging implementations at runtime
- **Content tooling** – Parse, sanitise, and post-process Arabic book content with utilities tailored for Shamela formatting
- **Environment awareness** – Automatically selects optimal sql.js WASM bundles for Node.js, browsers, and bundled runtimes

## Development

- Use `bun install` (already run) to manage dependencies and prefer `bun test` for unit coverage.
- Run `bun run build` before committing to ensure the library compiles with `tsdown`.
- Use Biome for formatting and linting (`bunx biome format --write` / `bunx biome check`). The config lives in `biome.json`.
- Tests live beside the source files under `src/` and in the `testing/` directory for E2E checks.
- Prefer writing unit tests with Bun's built-in test runner (`bun:test`).
- Documentation resides in `README.md`; update it when adding or modifying public APIs.
- Keep the repository side-effect free—temporary files should go under `/tmp` or be cleaned up after use.

## Code Style & Conventions

Enforced via Biome (`biome.json`):

| Setting | Value |
|---------|-------|
| Indent style | Spaces (4-width) |
| Line width | 120 characters |
| Quote style | Single quotes |
| Semicolons | Always |
| Trailing commas | All |
| Arrow parentheses | Always |
| Bracket spacing | Enabled |

### TypeScript Conventions

- **Types over interfaces** – Prefer `type` declarations for consistency
- **Explicit return types** – Add return types to exported functions
- **JSDoc comments** – Document all public APIs with `@param`, `@returns`, `@throws`, and `@example`
- **Sorted object keys** – Object keys should be alphabetically sorted (enforced by Biome)
- **Organized imports** – Imports auto-organized by Biome

### Naming Conventions

- **camelCase** – Variables, functions, parameters
- **PascalCase** – Types, interfaces, classes
- **SCREAMING_SNAKE_CASE** – Constants
- **kebab-case** – File names (except test files which use `.test.ts` suffix)

## Repository Structure

```
shamela/
├── src/                          # Main library source code
│   ├── index.ts                  # Main entry point (exports full API)
│   ├── api.ts                    # Core API functions (getBook, getMaster, download*, getCoverUrl)
│   ├── config.ts                 # Runtime configuration management
│   ├── content.ts                # Browser-safe content processing utilities
│   ├── types.ts                  # Public type definitions
│   ├── db/                       # Database layer
│   │   ├── book.ts               # Book database operations
│   │   ├── master.ts             # Master database operations
│   │   ├── queryBuilder.ts       # SQL query construction utilities
│   │   ├── sqlite.ts             # sql.js wrapper and initialization
│   │   └── types.ts              # Database row types
│   └── utils/                    # Utility modules
│       ├── common.ts             # Shared helpers (mappers, redactors)
│       ├── constants.ts          # Exported constants (DEFAULT_MAPPING_RULES)
│       ├── downloads.ts          # Download and archive handling
│       ├── io.ts                 # File I/O operations
│       ├── logger.ts             # Configurable logging
│       ├── network.ts            # HTTP utilities (buildUrl, httpsGet)
│       ├── validation.ts         # Input and environment validation
│       └── wasm.ts               # sql.js WASM location resolution
├── scripts/                      # Standalone reverse-engineering tools
│   ├── shamela-decoder.ts        # Shamela custom encoding decoder
│   ├── shamela-decoder.test.ts   # Decoder unit tests
│   ├── export-narrators.ts       # Narrator biography export script
│   ├── export-narrators.test.ts  # Export tests
│   ├── export-narrators-txt.ts   # Alternative narrator export format
│   ├── export-roots.ts           # Arabic root morphology export
│   ├── export-roots.test.ts      # Root export tests
│   ├── AGENTS.md                 # Reverse-engineering AI guide
│   └── README.md                 # Scripts documentation
├── demo/                         # Next.js demo application
│   ├── app/                      # Next.js app router
│   │   ├── api/shamela/          # API routes for book/master operations
│   │   ├── components/           # React components
│   │   └── page.tsx              # Main demo page
│   └── lib/shamela.ts            # Server-side Shamela configuration
├── testing/                      # End-to-end tests
│   └── e2e.test.ts               # E2E test suite
├── dist/                         # Compiled output (generated)
├── biome.json                    # Linting and formatting configuration
├── tsconfig.json                 # TypeScript configuration
├── tsdown.config.ts              # Build configuration
└── package.json                  # Package manifest
```

### Key Source Files

| File | Purpose |
|------|---------|
| `src/api.ts` | Primary API functions for downloading and retrieving book/master data |
| `src/config.ts` | Runtime configuration with environment variable fallbacks |
| `src/content.ts` | Browser-safe HTML parsing and Arabic text processing |
| `src/db/sqlite.ts` | sql.js database initialization and WASM loading |
| `src/utils/constants.ts` | Exportable constants including `DEFAULT_MAPPING_RULES` |

## Package Exports

The library uses conditional exports for browser/Node.js compatibility:

| Export | Entry Point | Description |
|--------|-------------|-------------|
| `shamela` | `src/index.ts` | Full API including sql.js (Node.js/server-side) |
| `shamela/content` | `src/content.ts` | Content utilities only, browser-safe (~1.5KB gzipped) |
| `shamela/types` | `src/types.ts` | Type definitions only |
| `shamela/constants` | `src/utils/constants.ts` | Constants like `DEFAULT_MAPPING_RULES` for extending content processing |

### Adding New Exports

1. Create entry point in `src/` (e.g., `src/newmodule.ts`)
2. Add to `tsdown.config.ts` entry array
3. Add to `package.json` exports field with `types`, `import`, and `default` conditions
4. Run `bun run build` to verify

### Browser Compatibility

- `src/content.ts` must NOT import from `./api`, `./db/`, or `./config` (these pull in sql.js)
- Content utilities should be pure JavaScript string processing
- When adding new utilities, consider if they belong in `content.ts` (browser-safe) or `index.ts` (full API)

## Scripts Folder

The `scripts/` directory contains standalone reverse-engineering tools for extracting and decoding data from Shamela's desktop application databases. These scripts are **not part of the published npm package** but are essential development tools.

### Overview

| Script | Purpose |
|--------|---------|
| `shamela-decoder.ts` | Core decoder for Shamela's custom character encoding (substitution cipher) |
| `export-narrators.ts` | Exports 18,989 narrator biographies from `S1.db` |
| `export-narrators-txt.ts` | Alternative text-based narrator export format |
| `export-roots.ts` | Exports 3.2M Arabic word→root morphological mappings from `S2.db` |

### Running Scripts

```bash
# Export narrators to JSON
bun run scripts/export-narrators.ts

# Export Arabic roots
bun run scripts/export-roots.ts

# Run script tests
bun test scripts/
```

### Documentation

The scripts have their own documentation:
- `scripts/AGENTS.md` – Comprehensive AI agent guide for reverse-engineering work
- `scripts/README.md` – Quick start and methodology documentation

See `scripts/AGENTS.md` for detailed information on:
- Database schema discoveries
- Character encoding algorithm
- Validation approaches
- Common patterns
- Debugging techniques

## Testing

```bash
# Run unit tests
bun test src/

# Run script tests
bun test scripts/

# Run E2E tests (requires network)
RUN_E2E=true bun test e2e

# Run all tests
bun test
```

### Test Conventions

- Test files use `.test.ts` suffix and live alongside source files
- Use `describe`/`it` blocks from `bun:test`
- Group related tests with nested `describe` blocks
- Test edge cases: empty strings, null values, unicode, long strings

## API Design Principles

1. **Ergonomic defaults** – Functions work out-of-the-box with minimal configuration
2. **Progressive disclosure** – Simple use cases are simple; advanced options available when needed
3. **Fail fast** – Validate inputs early and throw descriptive errors
4. **Clean separation** – Browser-safe utilities separated from Node.js-only code
5. **Type safety** – Full TypeScript with exported types for all public APIs
