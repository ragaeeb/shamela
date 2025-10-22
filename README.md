# shamela

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e)
[![E2E](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml/badge.svg)](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml)
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
    - [Getting Book Cover URLs](#getting-book-cover-urls)
- [Data Structures](#data-structures)
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

## Storybook demo

An interactive Storybook playground (`stories/ShamelaDemo.stories.ts`) lets you validate API keys, endpoints, and book downloads directly in the browser. Because the Shamela API does not enable CORS, run the bundled proxy in one terminal before starting Storybook:

```bash
bun run proxy
```

In a second terminal, start Storybook:

```bash
bun run storybook
```

The demo defaults to `http://localhost:8787/api/*` endpoints so credentials can be routed through the proxy. To generate a static build:

```bash
bun run storybook:build
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
