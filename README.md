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

## Table of Contents

- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
    - [Getting Started](#getting-started)
    - [Next.js / Bundled Environments](#nextjs--bundled-environments)
    - [API Functions](#api-functions)
        - [getMasterMetadata](#getmastermetadata)
        - [downloadMasterDatabase](#downloadmasterdatabase)
        - [getBookMetadata](#getbookmetadata)
        - [downloadBook](#downloadbook)
        - [getBook](#getbook)
        - [getMaster](#getmaster)
        - [getCoverUrl](#getcoverurl)
- [Examples](#examples)
    - [Downloading the Master Database](#downloading-the-master-database)
    - [Downloading a Book](#downloading-a-book)
    - [Retrieving Book Data](#retrieving-book-data)
    - [Retrieving Master Data in memory](#retrieving-master-data-in-memory)
- [Data Structures](#data-structures)
- [Next.js demo](#nextjs-demo)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [License](#license)

## Installation

```bash
bun add shamela
```

or

```bash
npm install shamela
```

or

```bash
yarn add shamela
```

or

```bash
pnpm install shamela
```

## Environment Variables

Before using the library, you need to set up some environment variables for API keys and endpoints:

- `SHAMELA_API_KEY`: Your API key for accessing the Shamela API.
- `SHAMELA_API_MASTER_PATCH_ENDPOINT`: The endpoint URL for the master database patches.
- `SHAMELA_API_BOOKS_ENDPOINT`: The base endpoint URL for book-related API calls.
- `SHAMELA_SQLJS_WASM_URL` (optional): Override the default CDN URL used to load the `sql.js` WebAssembly binary when running in the browser.

You can set these variables in a `.env` file at the root of your project:

```dotenv
SHAMELA_API_KEY=your_api_key_here
SHAMELA_API_MASTER_PATCH_ENDPOINT=https://shamela.ws/api/master_patch
SHAMELA_API_BOOKS_ENDPOINT=https://shamela.ws/api/books
# Optional when you host sql-wasm.wasm yourself
# SHAMELA_SQLJS_WASM_URL=https://example.com/sql-wasm.wasm
```

### Runtime configuration (browsers and serverless)

When you cannot rely on environment variables—such as when running inside a browser, an edge worker, or a serverless function—use the `configure` helper to provide credentials at runtime:

```ts
import { configure } from 'shamela';

configure({
    apiKey: process.env.NEXT_PUBLIC_SHAMELA_KEY,
    booksEndpoint: 'https://shamela.ws/api/books',
    masterPatchEndpoint: 'https://shamela.ws/api/master_patch',
    // Optional: host sql-wasm.wasm yourself to control caching/CDN placement
    sqlJsWasmUrl: '/assets/sql-wasm.wasm',
    // Optional: integrate with your application's logging system
    logger: console,
    // Optional: provide a custom fetch implementation (for tests or SSR)
    fetchImplementation: fetch,
});
```

You can call `configure` multiple times—values are merged, so later calls update only the keys you pass in.

The optional `logger` must expose `debug`, `info`, `warn`, and `error` methods. When omitted, the library stays silent by default.

## Usage

### Getting Started

First, import the library functions into your project:

```javascript
import {
    getMasterMetadata,
    downloadMasterDatabase,
    getBookMetadata,
    downloadBook,
    getBook,
    getMaster,
    getCoverUrl,
} from 'shamela';
```

### Next.js / Bundled Environments

When using this library in Next.js or other bundled environments (webpack/Turbopack), you need some additional configuration to ensure the sql.js WASM file is loaded correctly.

#### 1. Update your Next.js configuration

Add the following to your `next.config.js` or `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['shamela', 'sql.js'],
  },
  serverExternalPackages: ['shamela', 'sql.js'],
  // ... rest of your config
};

export default nextConfig;
```

This tells Next.js to exclude these packages from bundling and load them directly from `node_modules`.

#### 2. Create a server-only configuration file

Create a configuration file that will be imported only in server-side code:

**Option A: Using the `createNodeConfig` helper (Recommended)**

```typescript
// lib/shamela-server.ts
import { configure, createNodeConfig } from 'shamela';

// Configure once when this module loads
configure(createNodeConfig({
  apiKey: process.env.SHAMELA_API_KEY,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
}));

// Re-export the functions you need
export { getBookMetadata, downloadBook, getMaster, getBook } from 'shamela';
```

**Option B: Manual configuration**

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

export { getBookMetadata, downloadBook, getMaster, getBook } from 'shamela';
```

#### 3. Use in Server Actions or API Routes

```typescript
'use server';

import { getBookMetadata, downloadBook } from '@/lib/shamela-server';

export async function downloadBookAction(bookId: number) {
  const metadata = await getBookMetadata(bookId);
  const result = await downloadBook(bookId, {
    bookMetadata: metadata,
    outputFile: { path: `./books/${bookId}.db` }
  });
  return result;
}
```

**Important:** Never import `shamela` directly in your `layout.tsx` or client components. Only use it in server-side code (Server Actions, API Routes, or Server Components).

### API Functions

#### getMasterMetadata

Fetches metadata for the master database.

```typescript
getMasterMetadata(version?: number): Promise<GetMasterMetadataResponsePayload>
```

- `version` (optional): The version number of the master database you want to check for updates (defaults to 0)

**Returns:** Promise that resolves to master database metadata including download URL and version

**Example:**

```javascript
const masterMetadata = await getMasterMetadata();
console.log(masterMetadata.url); // Download URL for master database patch
console.log(masterMetadata.version); // Latest version number

// Check for updates from a specific version
const updates = await getMasterMetadata(5);
```

#### downloadMasterDatabase

Downloads the master database and saves it to a specified path. The master database contains comprehensive information about all books, authors, and categories available in the Shamela library.

```typescript
downloadMasterDatabase(options: DownloadMasterOptions): Promise<string>
```

- `options`: Configuration object containing:
    - `masterMetadata` (optional): Pre-fetched metadata from `getMasterMetadata`
    - `outputFile`: Object with `path` property specifying the output file path

**Returns:** Promise that resolves to the path of the created output file

**Example:**

```javascript
// Download as SQLite database
await downloadMasterDatabase({
    outputFile: { path: './master.db' },
});

// Download as JSON
await downloadMasterDatabase({
    outputFile: { path: './master.json' },
});

// Use pre-fetched metadata for efficiency
const masterMetadata = await getMasterMetadata();
await downloadMasterDatabase({
    masterMetadata,
    outputFile: { path: './master.db' },
});
```

#### getBookMetadata

Fetches metadata for a specific book.

```typescript
getBookMetadata(id: number, options?: GetBookMetadataOptions): Promise<GetBookMetadataResponsePayload>
```

- `id`: The unique identifier of the book
- `options` (optional): Configuration object containing:
    - `majorVersion`: The major version to check against
    - `minorVersion`: The minor version to check against

**Returns:** Promise that resolves to book metadata including release URLs and versions

**Example:**

```javascript
const metadata = await getBookMetadata(26592);
console.log(metadata.majorReleaseUrl); // URL for downloading the book
console.log(metadata.majorRelease); // Major version number

// Check specific versions
const versionedMetadata = await getBookMetadata(26592, {
    majorVersion: 1,
    minorVersion: 2,
});
```

#### downloadBook

Downloads and processes a book from the Shamela database. This function downloads the book's database files, applies patches if available, and exports the data to the specified format.

```typescript
downloadBook(id: number, options: DownloadBookOptions): Promise<string>
```

- `id`: The unique identifier of the book to download
- `options`: Configuration object containing:
    - `bookMetadata` (optional): Pre-fetched metadata from `getBookMetadata`
    - `outputFile`: Object with `path` property specifying the output file path

**Returns:** Promise that resolves to the path of the created output file

**Example:**

```javascript
// Download as JSON
await downloadBook(26592, {
    outputFile: { path: './book.json' },
});

// Download as SQLite database
await downloadBook(26592, {
    outputFile: { path: './book.db' },
});

// Use pre-fetched metadata for efficiency
const bookMetadata = await getBookMetadata(26592);
await downloadBook(26592, {
    bookMetadata,
    outputFile: { path: './book.db' },
});
```

#### getBook

Retrieves complete book data as a JavaScript object. This is a convenience function that handles temporary file creation and cleanup automatically.

```typescript
getBook(id: number): Promise<BookData>
```

- `id`: The unique identifier of the book to retrieve

**Returns:** Promise that resolves to complete book data including pages and titles

**Example:**

```javascript
const bookData = await getBook(26592);
console.log(bookData.pages.length); // Number of pages in the book
console.log(bookData.titles?.length); // Number of title entries
console.log(bookData.pages[0].content); // Content of the first page
```

#### getMaster

Retrieves the entire master dataset (authors, books, categories) as a JavaScript object, including the version number that the
API reports for the snapshot.

```typescript
getMaster(): Promise<MasterData>
```

**Returns:** Promise that resolves to the complete master dataset with version metadata

**Example:**

```javascript
const masterData = await getMaster();
console.log(masterData.version); // Version of the downloaded master database
console.log(masterData.books.length); // Number of books available
console.log(masterData.categories.length); // Number of categories available
```

#### getCoverUrl

Generates the URL for a book's cover image.

```typescript
getCoverUrl(bookId: number): string
```

- `bookId`: The unique identifier of the book

**Returns:** The complete URL to the book's cover image

**Example:**

```javascript
const coverUrl = getCoverUrl(26592);
console.log(coverUrl); // "https://shamela.ws/covers/26592.jpg"
```

## Examples

### Downloading the Master Database

```javascript
import { downloadMasterDatabase } from 'shamela';

(async () => {
    try {
        // Download as SQLite database
        const dbPath = await downloadMasterDatabase({
            outputFile: { path: './shamela_master.db' },
        });
        console.log(`Master database downloaded to: ${dbPath}`);

        // Download as JSON for programmatic access
        const jsonPath = await downloadMasterDatabase({
            outputFile: { path: './shamela_master.json' },
        });
        console.log(`Master data exported to: ${jsonPath}`);
        console.log('The JSON file includes authors, books, categories, and the master version number.');
    } catch (error) {
        console.error('Error downloading master database:', error);
    }
})();
```

### Downloading a Book

```javascript
import { downloadBook, getBookMetadata } from 'shamela';

(async () => {
    const bookId = 26592;

    try {
        // Download book as database file
        await downloadBook(bookId, {
            outputFile: { path: `./book_${bookId}.db` },
        });

        // Download with pre-fetched metadata
        const metadata = await getBookMetadata(bookId);
        await downloadBook(bookId, {
            bookMetadata: metadata,
            outputFile: { path: `./book_${bookId}.json` },
        });
    } catch (error) {
        console.error('Error downloading book:', error);
    }
})();
```

### Retrieving Book Data

```javascript
import { getBook } from 'shamela';

(async () => {
    try {
        const bookData = await getBook(26592);

        console.log(`Book has ${bookData.pages.length} pages`);

        if (bookData.titles) {
            console.log(`Book has ${bookData.titles.length} titles/chapters`);

            // Display table of contents
            bookData.titles.forEach((title) => {
                console.log(`${title.id}: ${title.content} (Page ${title.page})`);
            });
        }

        // Access page content
        const firstPage = bookData.pages[0];
        console.log(`First page content: ${firstPage.content.substring(0, 100)}...`);
    } catch (error) {
        console.error('Error retrieving book:', error);
    }
})();
```

### Retrieving Master Data in memory

```javascript
import { getMaster } from 'shamela';

(async () => {
    try {
        const masterData = await getMaster();

        console.log(`Master snapshot version: ${masterData.version}`);
        console.log(`Master dataset includes ${masterData.books.length} books`);
        console.log(`Master dataset includes ${masterData.categories.length} categories`);
    } catch (error) {
        console.error('Error retrieving master data:', error);
    }
})();
```

### Getting Book Cover URLs

```javascript
import { getCoverUrl, downloadMasterDatabase } from 'shamela';

(async () => {
    try {
        // Download master data to get book information
        const masterData = await downloadMasterDatabase({
            outputFile: { path: './master.json' },
        });

        // Read the master data
        const data = await Bun.file('./master.json').json();

        // Generate cover URLs for all books
        data.books.forEach((book) => {
            const coverUrl = getCoverUrl(book.id);
            console.log(`${book.name}: ${coverUrl}`);
        });
    } catch (error) {
        console.error('Error processing covers:', error);
    }
})();
```

## Data Structures

The library provides comprehensive TypeScript types for all data structures:

### BookData

- `pages`: Array of raw rows from the `page` table, including `content`, `id`, `part`, `page`, `number`, `services`, and `is_deleted`.
- `titles`: Array of raw rows from the `title` table with `content`, `id`, `page`, `parent`, and `is_deleted`.

### MasterData

- `authors`: Raw entries from the `author` table with the original `biography`, `death_text`, `death_number`, `is_deleted`, and `name` fields.
- `books`: Raw entries from the `book` table containing the original metadata columns (`author`, `bibliography`, `category`, `date`, `hint`, `major_release`, `metadata`, `minor_release`, `pdf_links`, `printed`, `type`, and `is_deleted`).
- `categories`: Raw entries from the `category` table including `is_deleted`, `order`, and `name`.
- `version`: Version number reported by the Shamela API for the downloaded master database.

### Page

- `id`: Unique identifier.
- `content`: Text content of the page.
- `part`, `page`, `number`: Numeric references stored exactly as they appear in the source database.
- `services`: Optional metadata column from the source database.
- `is_deleted`: Flag indicating whether the page has been marked as deleted in Shamela updates.

### Title

- `id`: Unique identifier.
- `content`: Title text.
- `page`: Page number where title appears (if available).
- `parent`: Optional parent title ID for hierarchical structure.
- `is_deleted`: Flag indicating whether the title has been marked as deleted.

### Content helpers

- `parseContentRobust(content: string)`: Converts Shamela page HTML into a list of structured lines while preserving title markers and punctuation.
- `sanitizePageContent(content: string)`: Removes common footnote markers and normalises ligatures from Shamela pages.

## Next.js demo

A minimal Next.js 16 application in `demo/` replaces the previous Storybook setup and offers an RTL-friendly explorer for the Shamela APIs. The server renders requests so the browser can bypass CORS limits and you only need to provide an API key and book identifier at runtime.

Create a `demo/.env.local` file (or export the variables in your shell) containing the real endpoints you wish to call:

```dotenv
SHAMELA_API_MASTER_PATCH_ENDPOINT=https://dev.shamela.ws/api/v1/patches/master
SHAMELA_API_BOOKS_ENDPOINT=https://dev.shamela.ws/api/v1/patches/book-updates
# Optional when hosting the wasm asset yourself
# SHAMELA_SQLJS_WASM_URL=https://example.com/sql-wasm.wasm
```

Then launch the demo:

```bash
bun run demo
```

Visit [http://localhost:3000](http://localhost:3000) to enter your API key, choose a book ID, and call helpers like `getMasterMetadata`, `getMaster`, `getBook`, and `downloadMasterDatabase` directly from the interface. For production-style builds use:

```bash
bun run demo:build
bun run demo:start
```

When deploying to Vercel, point the project to the `demo` directory and supply the same environment variables in the dashboard so the API routes can reach Shamela.

## Troubleshooting

### Error: "Unable to locate sql-wasm.wasm file"

This error occurs when the library cannot automatically find the WASM file. This is common in bundled environments like Next.js with Turbopack/Webpack.

**Solution:** Use the `createNodeConfig` helper or explicitly configure `sqlJsWasmUrl`:

```typescript
import { configure, createNodeConfig } from 'shamela';

// Option 1: Use the helper (recommended)
configure(createNodeConfig({
  apiKey: process.env.SHAMELA_API_KEY,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
}));

// Option 2: Manual configuration
import { join } from 'node:path';

configure({
  sqlJsWasmUrl: join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  apiKey: process.env.SHAMELA_API_KEY,
  // ... other config
});
```

### Error: "ENOENT: no such file or directory, open 'https://...'"

This means you're in a Node.js environment but providing an HTTPS URL for the WASM file. Node.js requires a filesystem path, not a URL.

**Solution:** Use a filesystem path instead of a URL:

```typescript
// ❌ Wrong - HTTPS URL in Node.js
configure({
  sqlJsWasmUrl: 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm'
});

// ✅ Correct - Filesystem path or use createNodeConfig
import { createNodeConfig } from 'shamela';

configure(createNodeConfig({
  apiKey: process.env.SHAMELA_API_KEY,
  // ... other config
}));
```

### Next.js: Module not found errors during build

If you see webpack/Turbopack errors about not being able to resolve modules during the build phase:

1. Make sure you've added `serverExternalPackages` to your `next.config.js` (see [Next.js / Bundled Environments](#nextjs--bundled-environments))
2. Ensure you're only importing shamela in server-side code (Server Actions, API Routes, Server Components)
3. Never import shamela in `layout.tsx` or client components
4. Create a separate `lib/shamela-server.ts` file for configuration

### Double `node_modules/node_modules` path error

If you see paths like `/path/to/project/node_modules/node_modules/sql.js/...`, this indicates the library's auto-detection failed due to bundling. Use explicit configuration:

```typescript
import { configure, createNodeConfig } from 'shamela';

configure(createNodeConfig({
  apiKey: process.env.SHAMELA_API_KEY,
  booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
  masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
}));
```

## Testing

The library includes comprehensive tests powered by `bun test`. To run the unit suite, ensure you have the necessary environment variables set, then execute:

```bash
bun test src
```

For end-to-end tests:

```bash
bun run e2e
```

### Formatting

Apply Biome formatting across the repository with:

```bash
bun run format
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
