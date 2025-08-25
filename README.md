# Shamela

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/faef70ab-efdb-448b-ab83-0fc66c95888e)
[![E2E](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml/badge.svg)](https://github.com/ragaeeb/shamela/actions/workflows/e2e.yml)
[![Node.js CI](https://github.com/ragaeeb/shamela/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/shamela/actions/workflows/build.yml) ![GitHub License](https://img.shields.io/github/license/ragaeeb/shamela)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/shamela)
[![codecov](https://codecov.io/gh/ragaeeb/shamela/graph/badge.svg?token=PK55V1R324)](https://codecov.io/gh/ragaeeb/shamela)
[![Size](https://deno.bundlejs.com/badge?q=shamela@latestq)](https://bundlejs.com/?q=shamela%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![npm](https://img.shields.io/npm/v/shamela)
![npm](https://img.shields.io/npm/dm/shamela)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/shamela)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/shamela?style=social)

A `NodeJS` library for accessing and downloading Maktabah Shamela v4 APIs. This library provides easy-to-use functions to interact with the Shamela API, download master and book databases, and retrieve book data programmatically.

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
- [Examples](#examples)
    - [Downloading the Master Database](#downloading-the-master-database)
    - [Downloading a Book](#downloading-a-book)
    - [Retrieving Book Data](#retrieving-book-data)
- [Testing](#testing)
- [License](#license)

## Installation

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

`SHAMELA_API_KEY`: Your API key for accessing the Shamela API.
`SHAMELA_API_MASTER_PATCH_ENDPOINT`: The endpoint URL for the master database patches.
`SHAMELA_API_BOOKS_ENDPOINT`: The base endpoint URL for book-related API calls.
You can set these variables in a `.env` file at the root of your project:

```dotenv
SHAMELA_API_KEY=your_api_key_here
SHAMELA_API_MASTER_PATCH_ENDPOINT=https://shamela.ws/api/master_patch
SHAMELA_API_BOOKS_ENDPOINT=https://shamela.ws/api/books
```

## Usage

### Getting Started

First, import the library functions into your project:

```javascript
import { getMasterMetadata, downloadMasterDatabase, getBookMetadata, downloadBook, getBook } from 'shamela';
```

### API Functions

#### getMasterMetadata

Fetches metadata for the master database.

```typescript
getMasterMetadata(version?: number): Promise<GetMasterMetadataResponsePayload>

```

- version (optional): The version number of the master database you want to fetch.

Example:

```javascript
const masterMetadata = await getMasterMetadata();
```

#### downloadMasterDatabase

Downloads the master database and saves it to a specified path.

```typescript
downloadMasterDatabase(options: DownloadMasterOptions): Promise<string>

```

- options: An object containing:
    - masterMetadata (optional): The metadata obtained from getMasterMetadata.
    - outputFile: An object specifying the output path.

Example:

```javascript
await downloadMasterDatabase({
    outputFile: { path: './master.db' },
});
```

#### getBookMetadata

Fetches metadata for a specific book.

```typescript
getBookMetadata(id: number, options?: GetBookMetadataOptions): Promise<GetBookMetadataResponsePayload>
```

- id: The ID of the book.
- options (optional): An object containing:
    - majorVersion: The major version of the book.
    - minorVersion: The minor version of the book.

Example:

```javascript
await downloadMasterDatabase({
    outputFile: { path: './master.db' },
});
```

#### getBook

Retrieves the data of a book as a JavaScript object.

```typescript
getBook(id: number): Promise<BookData>
```

- id: The ID of the book.

Example:

```javascript
const bookData = await getBook(26592);
```

## Examples

### Downloading the Master Database

```javascript
import { downloadMasterDatabase } from 'shamela';

(async () => {
    await downloadMasterDatabase({
        outputFile: { path: './master.db' },
    });
})();
```

### Downloading a Book

```javascript
import { downloadBook } from 'shamela';

(async () => {
    await downloadBook(26592, {
        outputFile: { path: './book.db' },
    });
})();
```

### Retrieving Book Data

```javascript
import { getBook } from 'shamela';

(async () => {
    const bookData = await getBook(26592);
    console.log(bookData);
})();
```

## Testing

The library includes tests to help you understand how the APIs are used. To run the tests, ensure you have the necessary environment variables set, then execute:

```bash
npm run test
```

For end-to-end tests:

```bash
npm run e2e
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
