https://dev.shamela.ws/updates/win/87_64.zip
https://dev.shamela.ws/versions/win.php
https://dev.shamela.ws/api/v1/patches/master?api_key=7b9524-8fc30c-e6241o-a0167e-a6d013&version=0
https://dev.shamela.ws/api/v1/patches/master-download/master-0-1209.zip?api_key=7b9524-8fc30c-e6241o-a0167e-a6d013
https://dev.shamela.ws/covers/3.jpg?1
https://dev.shamela.ws/api/v1/patches/book-updates/1681?api_key=7b9524-8fc30c-e6241o-a0167e-a6d013&major_release=0&minor_release=0
https://ready.shamela.ws/ready/1681-6-1.zip

# shamela

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e)
[![E2E](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml/badge.svg)](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml)
[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/shamela)](https://shamela.vercel.app)
[![Node.js CI](https://github.com/ragaeeb/shamela/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/shamela/actions/workflows/build.yml) ![GitHub License](https://img.shields.io/github/license/ragaeeb/shamela)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/shamela)
[![codecov](https://codecov.io/gh/ragaeeb/shamela/graph/badge.svg?token=PK55V1R324)](https://codecov.io/gh/ragaeeb/shamela)
[![Size](https://deno.bundlejs.com/badge?q=shamela@latest)](https://bundlejs.com/?q=shamela%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![npm](https://img.shields.io/npm/v/shamela)
![npm](https://img.shields.io/npm/dm/shamela)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/shamela)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/shamela?style=social)

A universal TypeScript library for accessing and downloading Maktabah Shamela v4 APIs. The package runs in both Node.js and modern browsers, providing ergonomic helpers to interact with the Shamela API, download master and book databases, and retrieve book data programmatically.

## Features

- 🚀 **Full data lifecycle** – fetch metadata, download master and book databases, and query the results entirely in-memory.
- 🔐 **Runtime configuration** – configure API credentials, WASM paths, and custom fetch/logging implementations at runtime.
- 🧠 **Content tooling** – parse, sanitise, and post-process Arabic book content with utilities tailored for Shamela formatting.
- 🌐 **Environment aware** – automatically selects optimal sql.js WASM bundles for Node.js, browsers, and bundled runtimes.
- 🧪 **Well-tested** – comprehensive unit and end-to-end coverage to ensure reliable integrations.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Standard Node.js](#standard-nodejs)
  - [Next.js / Bundled Environments](#nextjs--bundled-environments)
  - [Browser (Full API)](#browser-full-api)
  - [Browser (Content Utilities Only)](#browser-content-utilities-only)
- [API Reference](#api-reference)
  - [Configuration](#configuration)
    - [configure](#configure)
    - [resetConfig](#resetconfig)
    - [getConfig](#getconfig)
    - [getConfigValue](#getconfigvalue)
    - [requireConfigValue](#requireconfigvalue)
  - [Metadata & Downloads](#metadata--downloads)
    - [getMasterMetadata](#getmastermetadata)
    - [downloadMasterDatabase](#downloadmasterdatabase)
    - [getBookMetadata](#getbookmetadata)
    - [downloadBook](#downloadbook)
    - [getCoverUrl](#getcoverurl)
  - [Data Access](#data-access)
    - [getBook](#getbook)
    - [getMaster](#getmaster)
  - [Content Utilities](#content-utilities)
    - [parseContentRobust](#parsecontentrobust)
    - [sanitizePageContent](#sanitizepagecontent)
    - [splitPageBodyFromFooter](#splitpagebodyfromfooter)
    - [removeArabicNumericPageMarkers](#removearabicnumericpagemarkers)
    - [removeTagsExceptSpan](#removetagsexceptspan)
  - [Supporting Utilities](#supporting-utilities)
    - [buildUrl](#buildurl)
    - [httpsGet](#httpsget)
- [Examples](#examples)
- [Data Structures](#data-structures)
- [Next.js Demo](#nextjs-demo)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [License](#license)

## Installation

```bash
npm install shamela
```

```bash
bun add shamela
```

```bash
yarn add shamela
```

```bash
pnpm install shamela
```

## Quick Start

### Standard Node.js

For simple Node.js scripts (non-bundled environments), the library auto-detects the WASM file:

```typescript
import { configure, getBook } from 'shamela';

// Configure API credentials
configure({
  apiKey: process.env.SHAMELA_API_KEY,
  // Configure only the endpoints you need:
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,     // Required for book APIs
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT, // Required for master APIs
  // sqlJsWasmUrl is auto-detected in standard Node.js
});

// Use the library
const book = await getBook(26592);
console.log(`Downloaded book with ${book.pages.length} pages`);
```

### Next.js / Bundled Environments

For Next.js, webpack, Turbopack, and other bundlers, you need to explicitly configure the WASM file path.

**1. Update `next.config.ts` or `next.config.js`:**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['shamela', 'sql.js'],
  // ... rest of your config
};

export default nextConfig;
```

**2. Create a server-only configuration file:**

```typescript
// lib/shamela-server.ts
import { configure } from 'shamela';
import { join } from 'node:path';

configure({
  sqlJsWasmUrl: join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  apiKey: process.env.SHAMELA_API_KEY,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
});

export { downloadBook, getBook, getBookMetadata, getMaster, downloadMasterDatabase } from 'shamela';
```

**3. Use in Server Actions:**

```typescript
'use server';

import { getBookMetadata, downloadBook } from '@/lib/shamela-server';

export async function downloadBookAction(bookId: number) {
  const metadata = await getBookMetadata(bookId);
  return await downloadBook(bookId, {
    bookMetadata: metadata,
    outputFile: { path: `./books/${bookId}.db` }
  });
}
```

**Important:** Only import `shamela` in server-side code (Server Actions, API Routes, or Server Components). Never import in client components or `layout.tsx`.

### Browser (Full API)

In browsers, the library automatically uses a CDN-hosted WASM file:

```typescript
import { configure, getBook } from 'shamela';

configure({
  apiKey: 'your-api-key',
  booksEndpoint: 'https://SHAMELA_INSTANCE.ws/api/books',
  masterPatchEndpoint: 'https://SHAMELA_INSTANCE.ws/api/master_patch',
  // Automatically uses CDN: https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm
});

const book = await getBook(26592);
```

### Browser (Content Utilities Only)

If you only need the content processing utilities (sanitization, parsing, etc.) without the database functionality, use the lightweight `shamela/content` export:

```typescript
import {
  sanitizePageContent,
  splitPageBodyFromFooter,
  removeTagsExceptSpan,
  parseContentRobust,
} from 'shamela/content';

// Process content without loading sql.js (~1.5KB gzipped vs ~900KB)
const clean = removeTagsExceptSpan(sanitizePageContent(rawContent));
const [body, footnotes] = splitPageBodyFromFooter(clean);
```

This is ideal for:
- Client-side React/Next.js components
- Bundled environments where you want to avoid sql.js WASM
- Processing pre-downloaded book data

**Available exports from `shamela/content`:**
- `parseContentRobust` - Parse HTML into structured lines
- `mapPageCharacterContent` - Normalize Arabic text with mapping rules
- `splitPageBodyFromFooter` - Separate body from footnotes
- `removeArabicNumericPageMarkers` - Remove page markers
- `removeTagsExceptSpan` - Strip HTML except spans
- `htmlToMarkdown` - Convert Shamela HTML to Markdown
- `normalizeHtml` - Normalize hadeeth tags to standard spans

### Extending Content Processing Rules

You can import `DEFAULT_MAPPING_RULES` from `shamela/constants` to extend or customize the character mapping used by `mapPageCharacterContent`:

```typescript
import { mapPageCharacterContent } from 'shamela/content';
import { DEFAULT_MAPPING_RULES } from 'shamela/constants';

// Extend default rules with custom mappings
const customRules = {
  ...DEFAULT_MAPPING_RULES,
  'customPattern': 'replacement',
};

const processed = mapPageCharacterContent(rawContent, customRules);
```

## API Reference

### Configuration

#### configure

Initialises runtime configuration including API credentials, custom fetch implementations, sql.js WASM location, and logger overrides.

```typescript
configure(options: ConfigureOptions): void
```

**Example:**

```typescript
import { configure } from 'shamela';

configure({
  apiKey: process.env.SHAMELA_API_KEY!,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT!,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT!,
});
```

#### resetConfig

Clears runtime overrides and restores the default silent logger.

```typescript
resetConfig(): void
```

Use this in tests or long-running processes when you need a clean configuration slate.

#### getConfig

Returns the merged configuration snapshot combining runtime overrides with environment variables.

```typescript
getConfig(): ShamelaConfig
```

#### getConfigValue

Reads a single configuration value without throwing when it is missing.

```typescript
getConfigValue<Key extends ShamelaConfigKey>(key: Key): ShamelaConfig[Key] | undefined
```

#### requireConfigValue

Retrieves a configuration entry and throws an error if the value is not present.

```typescript
requireConfigValue(key: Exclude<ShamelaConfigKey, 'fetchImplementation'>): string
```

### Metadata & Downloads

#### getMasterMetadata

Fetches metadata for the master database, including download URLs for the latest patches.

```typescript
getMasterMetadata(version?: number): Promise<GetMasterMetadataResponsePayload>
```

- `version` (optional): The version number to check for updates (defaults to 0)

```typescript
const metadata = await getMasterMetadata();
console.log(metadata.url);     // Download URL
console.log(metadata.version); // Version number

// Check for updates from a specific version
const updates = await getMasterMetadata(5);
```

#### downloadMasterDatabase

Downloads the master database containing all books, authors, and categories and writes it to disk or a custom writer.

```typescript
downloadMasterDatabase(options: DownloadMasterOptions): Promise<string>
```

- `options.masterMetadata` (optional): Pre-fetched metadata to avoid an extra HTTP call
- `options.outputFile.path`: Output file path (`.db`, `.sqlite`, or `.json`)

```typescript
// Download as SQLite database
await downloadMasterDatabase({
  outputFile: { path: './master.db' }
});

// Download as JSON
await downloadMasterDatabase({
  outputFile: { path: './master.json' }
});
```

#### getBookMetadata

Fetches metadata for a specific book, including patch release information.

```typescript
getBookMetadata(id: number, options?: GetBookMetadataOptions): Promise<GetBookMetadataResponsePayload>
```

- `id`: Book identifier
- `options.majorVersion` (optional): Major version to check
- `options.minorVersion` (optional): Minor version to check

```typescript
const metadata = await getBookMetadata(26592);
console.log(metadata.majorReleaseUrl);
console.log(metadata.minorReleaseUrl);
```

#### downloadBook

Downloads and processes a book from Shamela, writing it to JSON or SQLite on disk.

```typescript
downloadBook(id: number, options: DownloadBookOptions): Promise<string>
```

- `id`: Book identifier
- `options.bookMetadata` (optional): Pre-fetched metadata to avoid re-fetching
- `options.outputFile.path`: Output file path (`.db`, `.sqlite`, or `.json`)

```typescript
// Download as JSON
await downloadBook(26592, {
  outputFile: { path: './book.json' }
});

// Download as SQLite
await downloadBook(26592, {
  outputFile: { path: './book.db' }
});
```

#### getCoverUrl

Generates the URL for a book's cover image using the configured Shamela host.

```typescript
getCoverUrl(bookId: number): string
```

```typescript
const coverUrl = getCoverUrl(26592);
// Returns: "https://shamela.ws/covers/26592.jpg"
```

### Data Access

#### getBook

Retrieves complete book data as a JavaScript object, returning pages and title entries.

```typescript
getBook(id: number): Promise<BookData>
```

```typescript
const book = await getBook(26592);
console.log(book.pages.length);
console.log(book.titles?.length);
console.log(book.pages[0].content);
```

#### getMaster

Retrieves the entire master dataset as a JavaScript object, including version information.

```typescript
getMaster(): Promise<MasterData>
```

```typescript
const master = await getMaster();
console.log(master.version);
console.log(master.books.length);
console.log(master.authors.length);
console.log(master.categories.length);
```

### Content Utilities

#### parseContentRobust

Parses Shamela HTML snippets into structured lines while preserving title hierarchy and Arabic punctuation.

```typescript
parseContentRobust(content: string): Line[]
```

```typescript
const lines = parseContentRobust(rawHtml);
lines.forEach((line) => console.log(line.id, line.text));
```

#### sanitizePageContent

Normalises page content by applying regex-based replacement rules tuned for Shamela sources.

```typescript
sanitizePageContent(text: string, rules?: Record<string, string>): string
```

#### splitPageBodyFromFooter

Separates page body content from trailing footnotes using the default Shamela marker.

```typescript
splitPageBodyFromFooter(content: string, marker?: string): readonly [string, string]
```

#### removeArabicNumericPageMarkers

Removes Arabic numeral markers enclosed in ⦗ ⦘, commonly used to denote page numbers.

```typescript
removeArabicNumericPageMarkers(text: string): string
```

#### removeTagsExceptSpan

Strips anchor and hadeeth tags while preserving nested `<span>` elements.

```typescript
removeTagsExceptSpan(content: string): string
```

### Supporting Utilities

#### buildUrl

Constructs authenticated API URLs with query parameters and optional API key injection.

```typescript
buildUrl(endpoint: string, queryParams: Record<string, any>, useAuth?: boolean): URL
```

#### httpsGet

Makes HTTPS GET requests using the configured fetch implementation, automatically parsing JSON responses and returning binary data otherwise.

```typescript
httpsGet<T extends Uint8Array | Record<string, any>>(url: string | URL, options?: { fetchImpl?: typeof fetch }): Promise<T>
```

## Examples

### Downloading the Master Database

```typescript
import { downloadMasterDatabase } from 'shamela';

// Download as SQLite
const dbPath = await downloadMasterDatabase({
  outputFile: { path: './shamela_master.db' }
});
console.log(`Downloaded to: ${dbPath}`);

// Download as JSON
const jsonPath = await downloadMasterDatabase({
  outputFile: { path: './shamela_master.json' }
});
```

### Downloading a Book

```typescript
import { downloadBook, getBookMetadata } from 'shamela';

const bookId = 26592;

// Download book
await downloadBook(bookId, {
  outputFile: { path: `./book_${bookId}.db` }
});

// With pre-fetched metadata
const metadata = await getBookMetadata(bookId);
await downloadBook(bookId, {
  bookMetadata: metadata,
  outputFile: { path: `./book_${bookId}.json` }
});
```

### Retrieving Book Data

```typescript
import { getBook } from 'shamela';

const book = await getBook(26592);

console.log(`Book has ${book.pages.length} pages`);

// Display table of contents
book.titles?.forEach(title => {
  console.log(`${title.id}: ${title.content} (Page ${title.page})`);
});

// Access page content
const firstPage = book.pages[0];
console.log(firstPage.content.substring(0, 100));
```

### Getting Book Covers

```typescript
import { getCoverUrl, getMaster } from 'shamela';

const master = await getMaster();

// Generate cover URLs for all books
master.books.forEach(book => {
  const coverUrl = getCoverUrl(book.id);
  console.log(`${book.name}: ${coverUrl}`);
});
```

## Data Structures

### BookData

```typescript
type BookData = {
  pages: Page[];
  titles: Title[];
};
```

### MasterData

```typescript
type MasterData = {
  authors: Author[];
  books: Book[];
  categories: Category[];
  version: number;
};
```

### Page

```typescript
type Page = {
  id: number;
  content: string;
  part?: string;
  page?: number;
  number?: string;
};
```

### Title

```typescript
type Title = {
  id: number;
  content: string;
  page: number;
  parent?: number;
};
```

### Content Helpers

- `parseContentRobust(content: string)`: Converts Shamela page HTML into structured lines
- `sanitizePageContent(content: string)`: Removes footnote markers and normalizes text
- `splitPageBodyFromFooter(content: string)`: Separates page content from footnotes
- `removeArabicNumericPageMarkers(text: string)`: Removes Arabic page number markers
- `removeTagsExceptSpan(content: string)`: Strips HTML tags except span elements

## Next.js Demo

A minimal Next.js 16 demo application is available in the `demo/` directory.

**Setup:**

Create `demo/.env.local`:

```env
SHAMELA_API_KEY=your_api_key
SHAMELA_API_MASTER_PATCH_ENDPOINT=https://SHAMELA_INSTANCE.ws/api/master_patch
SHAMELA_API_BOOKS_ENDPOINT=https://SHAMELA_INSTANCE.ws/api/books
```

**Run:**

```bash
bun run demo              # Development
bun run demo:build        # Production build
bun run demo:start        # Production server
```

Visit [http://localhost:3000](http://localhost:3000) to explore the API.

## Troubleshooting

### Error: "Unable to automatically locate sql-wasm.wasm file"

This occurs in bundled environments (Next.js, webpack, Turbopack). 

**Solution:** Add explicit configuration:

```typescript
import { configure } from 'shamela';
import { join } from 'node:path';

configure({
  sqlJsWasmUrl: join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  apiKey: process.env.SHAMELA_API_KEY,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
});
```

### Next.js: Module not found errors

1. Add to `next.config.ts`:
   ```typescript
   serverExternalPackages: ['shamela', 'sql.js']
   ```

2. Only import shamela in server-side code

3. Create a separate `lib/shamela-server.ts` for configuration

### Production build works differently than development

Ensure `serverExternalPackages` is set in your Next.js config for both development and production.

### Monorepo setup issues

Adjust the WASM path based on your structure:

```typescript
configure({
  sqlJsWasmUrl: join(process.cwd(), '../../node_modules/sql.js/dist/sql-wasm.wasm'),
  // ... other config
});
```

## Testing

Run tests with Bun:

```bash
bun test src              # Unit tests
bun run e2e               # End-to-end tests
bun run format            # Format code
bun run lint              # Lint code
```

## Scripts Folder

The `scripts/` directory contains standalone reverse-engineering tools for extracting and decoding data from Shamela's desktop application databases. These are **development tools**, not part of the published npm package.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `shamela-decoder.ts` | Core decoder for Shamela's custom character encoding |
| `export-narrators.ts` | Exports 18,989 narrator biographies from S1.db |
| `export-roots.ts` | Exports 3.2M Arabic word→root morphological mappings from S2.db |

### Running Scripts

```bash
# Export narrators to JSON
bun run scripts/export-narrators.ts

# Export Arabic roots
bun run scripts/export-roots.ts

# Run script tests
bun test scripts/
```

### Script Documentation

- `scripts/README.md` – Quick start guide and reverse-engineering methodology
- `scripts/AGENTS.md` – Comprehensive documentation including:
  - Database schema discoveries
  - Character encoding algorithm (substitution cipher)
  - Validation approaches and coverage statistics
  - Common patterns and debugging techniques

## License

MIT License - see LICENSE file for details.
