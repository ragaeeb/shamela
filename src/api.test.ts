import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// Tests for src/api.ts public API. These tests mock external dependencies (network, I/O, DB helpers)
// and validate behavior across happy paths, edge cases, and error scenarios.
// Testing library/framework: Bun test runner (bun:test)

// We import the module under test after setting up/overriding module mocks to ensure
// mocks are applied when the module loads. Bun's test runner supports mock.module.
const originalEnv = { ...process.env };

// Helper to reset ENV between tests
const resetEnv = () => {
  process.env = { ...originalEnv };
};

describe('API module: getBookMetadata, downloadBook, getMasterMetadata, getCoverUrl, downloadMasterDatabase, getBook', () => {
  beforeEach(() => {
    resetEnv();
    // Minimal environment variables used by API
    process.env.SHAMELA_API_BOOKS_ENDPOINT = process.env.SHAMELA_API_BOOKS_ENDPOINT || 'https://api.shamela.ws/books';
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT || 'https://api.shamela.ws/patch';
  });

  afterEach(() => {
    resetEnv();
  });

  test('getBookMetadata - happy path with major only (no minor)', async () => {
    // Arrange: mock validation, network, logger, and URL builder
    const validateEnvVariables = mock.fn(() => {});
    const buildUrl = mock.fn((base: string, params: Record<string, string>) => {
      // Return a URL-like object with toString
      const u = new URL(base + `?major_release=${params.major_release}&minor_release=${params.minor_release}`);
      return {
        href: u.href,
        toString: () => u.toString(),
      };
    });
    const httpsGet = mock.fn(async () => ({
      major_release: 3,
      major_release_url: 'http://downloads.example.com/book_3.zip', // note http to verify https fix
    }));
    const logger = { info: mock.fn(() => {}) };

    // Mock dependent modules
    await mock.module('./utils/validation.js', () => ({ validateEnvVariables }));
    await mock.module('./utils/network.js', () => ({ buildUrl, httpsGet }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    // Now import the unit under test
    const { getBookMetadata } = await import('./api.js');

    // Act
    const result = await getBookMetadata(123);

    // Assert
    expect(validateEnvVariables).toHaveBeenCalledTimes(1);
    expect(buildUrl).toHaveBeenCalledTimes(1);
    expect(httpsGet).toHaveBeenCalledTimes(1);
    expect(result.majorRelease).toBe(3);
    expect(result.majorReleaseUrl).toBe('https://downloads.example.com/book_3.zip'); // protocol should have been fixed
    expect(result.minorReleaseUrl).toBeUndefined();
    expect(result.minorRelease).toBeUndefined();
  });

  test('getBookMetadata - with minor release present', async () => {
    const validateEnvVariables = mock.fn(() => {});
    const buildUrl = mock.fn((base: string, params: Record<string, string>) => {
      const u = new URL(base + `?major_release=${params.major_release}&minor_release=${params.minor_release}`);
      return {
        href: u.href,
        toString: () => u.toString(),
      };
    });
    const httpsGet = mock.fn(async () => ({
      major_release: 4,
      major_release_url: 'http://downloads.example.com/book_4.zip',
      minor_release: 2,
      minor_release_url: 'http://downloads.example.com/book_4_patch_2.zip',
    }));
    const logger = { info: mock.fn(() => {}) };

    await mock.module('./utils/validation.js', () => ({ validateEnvVariables }));
    await mock.module('./utils/network.js', () => ({ buildUrl, httpsGet }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const { getBookMetadata } = await import('./api.js');

    const result = await getBookMetadata(555, { majorVersion: 1, minorVersion: 2 });

    expect(result.majorRelease).toBe(4);
    expect(result.majorReleaseUrl).toBe('https://downloads.example.com/book_4.zip');
    expect(result.minorRelease).toBe(2);
    expect(result.minorReleaseUrl).toBe('https://downloads.example.com/book_4_patch_2.zip');
  });

  test('getBookMetadata - network error surfaces as wrapped error', async () => {
    const validateEnvVariables = mock.fn(() => {});
    const buildUrl = mock.fn((base: string, params: Record<string, string>) => {
      const u = new URL(base + `?major_release=${params.major_release}&minor_release=${params.minor_release}`);
      return {
        href: u.href,
        toString: () => u.toString(),
      };
    });
    const httpsGet = mock.fn(async () => {
      const err = new Error('Network down');
      throw err;
    });
    const logger = { info: mock.fn(() => {}) };

    await mock.module('./utils/validation.js', () => ({ validateEnvVariables }));
    await mock.module('./utils/network.js', () => ({ buildUrl, httpsGet }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const { getBookMetadata } = await import('./api.js');

    await expect(getBookMetadata(1)).rejects.toThrow('Error fetching master patch: Network down');
  });

  test('downloadBook - happy path JSON without patch (copyTableData)', async () => {
    // Arrange
    const logger = { error: mock.fn(() => {}), info: mock.fn(() => {}) };
    const createTempDir = mock.fn(async () => '.tmp_downloadBook_1');
    const unzipFromUrl = mock.fn(async () => ['book_major.db']);
    const fsWriteFile = mock.fn(async () => {});
    const fsRename = mock.fn(async () => {});
    const fsRm = mock.fn(async () => {});
    const getBookData = mock.fn(async () => ({ pages: [{ n: 1, t: 'p1' }], titles: [] }));
    const createTables = mock.fn(async () => {});
    const copyTableData = mock.fn(async () => {});
    const applyPatches = mock.fn(async () => {});

    // Mock Database class from bun:sqlite
    class FakeDB {
      closed = false;
      constructor() {}
      close() { this.closed = true; }
    }

    // Module mocks
    await mock.module('bun:sqlite', () => ({ Database: FakeDB }));
    await mock.module('node:fs', () => ({ promises: { rename: fsRename, rm: fsRm, writeFile: fsWriteFile } }));
    await mock.module('./utils/io.js', () => ({ createTempDir, unzipFromUrl }));
    await mock.module('./db/book.js', () => ({
      applyPatches,
      copyTableData,
      createTables,
      getData: getBookData
    }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    // getBookMetadata returns only major (no minor patch)
    const getBookMetadata = mock.fn(async () => ({
      majorRelease: 1,
      majorReleaseUrl: 'https://downloads.example.com/book_1.zip'
    }));
    await mock.module('./api.js', async (actual) => {
      // Partially mock by returning actual but override getBookMetadata via re-export
      const real = await actual();
      return { ...real, getBookMetadata };
    });

    const { downloadBook } = await import('./api.js');

    // Act
    const outPath = await downloadBook(42, { outputFile: { path: 'out/book.json' } });

    // Assert
    expect(outPath).toBe('out/book.json');
    expect(createTables).toHaveBeenCalledTimes(1);
    expect(copyTableData).toHaveBeenCalledTimes(1);
    expect(applyPatches).toHaveBeenCalledTimes(0);
    expect(getBookData).toHaveBeenCalledTimes(1);
    expect(fsWriteFile).toHaveBeenCalledTimes(1);
    expect(fsRename).toHaveBeenCalledTimes(0);
    expect(fsRm).toHaveBeenCalledTimes(1);
  });

  test('downloadBook - with patch (applyPatches) and output .db', async () => {
    const logger = { info: mock.fn(() => {}) };
    const createTempDir = mock.fn(async () => '.tmp_downloadBook_2');
    const unzipFromUrl = mock.fn()
      // first call (major)
      .mockResolvedValueOnce(['book_major.db'])
      // second call (minor / patch)
      .mockResolvedValueOnce(['book_patch.db']);

    const fsWriteFile = mock.fn(async () => {});
    const fsRename = mock.fn(async () => {});
    const fsRm = mock.fn(async () => {});
    const getBookData = mock.fn(async () => ({}));
    const createTables = mock.fn(async () => {});
    const copyTableData = mock.fn(async () => {});
    const applyPatches = mock.fn(async () => {});

    class FakeDB {
      constructor() {}
      close() {}
    }

    await mock.module('bun:sqlite', () => ({ Database: FakeDB }));
    await mock.module('node:fs', () => ({ promises: { rename: fsRename, rm: fsRm, writeFile: fsWriteFile } }));
    await mock.module('./utils/io.js', () => ({ createTempDir, unzipFromUrl }));
    await mock.module('./db/book.js', () => ({
      applyPatches,
      copyTableData,
      createTables,
      getData: getBookData
    }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const getBookMetadata = mock.fn(async () => ({
      majorRelease: 1,
      majorReleaseUrl: 'https://downloads.example.com/book_1.zip',
      minorRelease: 1,
      minorReleaseUrl: 'https://downloads.example.com/book_1_patch_1.zip'
    }));
    await mock.module('./api.js', async (actual) => {
      const real = await actual();
      return { ...real, getBookMetadata };
    });

    const { downloadBook } = await import('./api.js');

    const outPath = await downloadBook(99, { outputFile: { path: 'out/book.db' } });

    expect(outPath).toBe('out/book.db');
    expect(createTables).toHaveBeenCalledTimes(1);
    expect(applyPatches).toHaveBeenCalledTimes(1);
    expect(copyTableData).toHaveBeenCalledTimes(0);
    expect(fsRename).toHaveBeenCalledTimes(1); // moved sqlite file
    expect(fsRm).toHaveBeenCalledTimes(1);
  });

  test('downloadBook - ensures db close in finally even if mid-process throws', async () => {
    const logger = { error: mock.fn(() => {}), info: mock.fn(() => {}) };
    const createTempDir = mock.fn(async () => '.tmp_downloadBook_3');
    const unzipFromUrl = mock.fn(async () => ['book_major.db']);

    const fsWriteFile = mock.fn(async () => { throw new Error('disk full'); });
    const fsRename = mock.fn(async () => {});
    const fsRm = mock.fn(async () => {});

    const getBookData = mock.fn(async () => ({ ok: true }));
    const createTables = mock.fn(async () => {});
    const copyTableData = mock.fn(async () => {});
    const applyPatches = mock.fn(async () => {});

    let closedFlag = false;
    class FakeDB {
      constructor() {}
      close() { closedFlag = true; }
    }

    await mock.module('bun:sqlite', () => ({ Database: FakeDB }));
    await mock.module('node:fs', () => ({ promises: { rename: fsRename, rm: fsRm, writeFile: fsWriteFile } }));
    await mock.module('./utils/io.js', () => ({ createTempDir, unzipFromUrl }));
    await mock.module('./db/book.js', () => ({
      applyPatches,
      copyTableData,
      createTables,
      getData: getBookData
    }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const getBookMetadata = mock.fn(async () => ({
      majorRelease: 1,
      majorReleaseUrl: 'https://downloads.example.com/book_1.zip',
    }));
    await mock.module('./api.js', async (actual) => {
      const real = await actual();
      return { ...real, getBookMetadata };
    });

    const { downloadBook } = await import('./api.js');

    await expect(downloadBook(7, { outputFile: { path: 'out/book.json' } })).rejects.toThrow('disk full');
    expect(closedFlag).toBe(true);
  });

  test('getMasterMetadata - happy path', async () => {
    const validateEnvVariables = mock.fn(() => {});
    const buildUrl = mock.fn((base: string, params: Record<string, string>) => {
      const u = new URL(base + `?version=${params.version}`);
      return {
        href: u.href,
        toString: () => u.toString(),
      };
    });
    const httpsGet = mock.fn(async () => ({
      patch_url: 'https://downloads.example.com/master_patch_v2.zip',
      version: 2
    }));
    const logger = { info: mock.fn(() => {}) };

    await mock.module('./utils/validation.js', () => ({ validateEnvVariables }));
    await mock.module('./utils/network.js', () => ({ buildUrl, httpsGet }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const { getMasterMetadata } = await import('./api.js');

    const meta = await getMasterMetadata(1);
    expect(meta.url).toBe('https://downloads.example.com/master_patch_v2.zip');
    expect(meta.version).toBe(2);
  });

  test('getMasterMetadata - wraps errors from httpsGet', async () => {
    const validateEnvVariables = mock.fn(() => {});
    const buildUrl = mock.fn((base: string, params: Record<string, string>) => {
      const u = new URL(base + `?version=${params.version}`);
      return {
        href: u.href,
        toString: () => u.toString(),
      };
    });
    const httpsGet = mock.fn(async () => { throw new Error('timeout'); });
    const logger = { info: mock.fn(() => {}) };

    await mock.module('./utils/validation.js', () => ({ validateEnvVariables }));
    await mock.module('./utils/network.js', () => ({ buildUrl, httpsGet }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const { getMasterMetadata } = await import('./api.js');

    await expect(getMasterMetadata()).rejects.toThrow('Error fetching master patch: timeout');
  });

  test('getCoverUrl - builds host-relative cover URL', async () => {
    // Provide endpoint env var so host is parsed from it
    process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT = 'https://api.shamela.ws/patch';
    const { getCoverUrl } = await import('./api.js');
    const url = getCoverUrl(12345);
    expect(url).toBe('api.shamela.ws/covers/12345.jpg');
  });

  test('downloadMasterDatabase - happy path JSON export', async () => {
    const logger = { error: mock.fn(() => {}), info: mock.fn(() => {}) };
    const createTempDir = mock.fn(async () => '.tmp_downloadMaster_1');
    const unzipFromUrl = mock.fn(async () => ['authors.txt', 'books.txt', 'categories.txt']);
    const validateTables = mock.fn(() => true);
    const createTables = mock.fn(async () => {});
    const copyForeign = mock.fn(async () => {});
    const getMasterData = mock.fn(async () => ({ authors: [], books: [], categories: [] }));

    // Bun.file(...).write mock
    const bunFileWrite = mock.fn(async () => {});
    const bunFile = mock.fn((_p: string) => { void _p; return { write: bunFileWrite }; });

    const fsRename = mock.fn(async () => {});
    const fsRm = mock.fn(async () => {});

    class FakeDB {
      constructor() {}
      close() {}
    }

    await mock.module('bun:sqlite', () => ({ Database: FakeDB }));
    await mock.module('./utils/io.js', () => ({ createTempDir, unzipFromUrl }));
    await mock.module('./utils/validation.js', () => ({
      validateEnvVariables: () => {},
      validateMasterSourceTables: validateTables
    }));
    await mock.module('./db/master.js', () => ({
      copyForeignMasterTableData: copyForeign,
      createTables,
      getData: getMasterData
    }));
    await mock.module('node:fs', () => ({ promises: { rename: fsRename, rm: fsRm } }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    // @ts-expect-error mocking global Bun.file
    globalThis.Bun = { file: bunFile };

    const getMasterMetadata = mock.fn(async () => ({
      url: 'http://downloads.example.com/master_patch.zip',
      version: 10
    }));
    await mock.module('./api.js', async (actual) => {
      const real = await actual();
      return { ...real, getMasterMetadata };
    });

    const { downloadMasterDatabase } = await import('./api.js');

    const out = await downloadMasterDatabase({ outputFile: { path: 'out/master.json' } });
    expect(out).toBe('out/master.json');
    expect(validateTables).toHaveBeenCalledTimes(1);
    expect(createTables).toHaveBeenCalledTimes(1);
    expect(copyForeign).toHaveBeenCalledTimes(1);
    expect(getMasterData).toHaveBeenCalledTimes(1);
    expect(bunFile).toHaveBeenCalledTimes(1);
    expect(bunFileWrite).toHaveBeenCalledTimes(1);
    expect(fsRename).toHaveBeenCalledTimes(0);
    expect(fsRm).toHaveBeenCalledTimes(1);
  });

  test('downloadMasterDatabase - invalid source tables throws', async () => {
    const logger = { error: mock.fn(() => {}), info: mock.fn(() => {}) };
    const createTempDir = mock.fn(async () => '.tmp_downloadMaster_2');
    const unzipFromUrl = mock.fn(async () => ['authors.txt']); // missing required tables
    const validateTables = mock.fn(() => false);

    const fsRename = mock.fn(async () => {});
    const fsRm = mock.fn(async () => {});

    class FakeDB {
      constructor() {}
      close() {}
    }

    await mock.module('bun:sqlite', () => ({ Database: FakeDB }));
    await mock.module('./utils/io.js', () => ({ createTempDir, unzipFromUrl }));
    await mock.module('./utils/validation.js', () => ({
      validateEnvVariables: () => {},
      validateMasterSourceTables: validateTables
    }));
    await mock.module('node:fs', () => ({ promises: { rename: fsRename, rm: fsRm } }));
    await mock.module('./utils/logger.js', () => ({ default: logger }));

    const getMasterMetadata = mock.fn(async () => ({
      url: 'http://downloads.example.com/master_patch.zip',
      version: 11
    }));
    await mock.module('./api.js', async (actual) => {
      const real = await actual();
      return { ...real, getMasterMetadata };
    });

    const { downloadMasterDatabase } = await import('./api.js');

    await expect(downloadMasterDatabase({ outputFile: { path: 'out/master.json' } }))
      .rejects
      .toThrow('Expected tables not found!');
  });

  test('getBook - delegates to downloadBook and returns parsed JSON, cleans up temp', async () => {
    const createTempDir = mock.fn(async () => '.tmp_getBook_1');
    const fsRm = mock.fn(async () => {});
    const bunFileJson = mock.fn(async () => ({ pages: [1,2], titles: ['t'] }));
    const bunFile = mock.fn((_p: string) => { void _p; return { json: bunFileJson }; });

    await mock.module('./utils/io.js', () => ({ createTempDir }));
    await mock.module('node:fs', () => ({ promises: { rm: fsRm } }));

    // @ts-expect-error mocking global Bun.file
    globalThis.Bun = { file: bunFile };

    const downloadBook = mock.fn(async (_id: number, { outputFile: { path } }: any) => path);
    await mock.module('./api.js', async (actual) => {
      const real = await actual();
      return { ...real, downloadBook };
    });

    const { getBook } = await import('./api.js');

    const result = await getBook(321);
    expect(downloadBook).toHaveBeenCalledTimes(1);
    expect(bunFileJson).toHaveBeenCalledTimes(1);
    expect(result.pages).toEqual([1,2]);
    expect(result.titles).toEqual(['t']);
    expect(fsRm).toHaveBeenCalledTimes(1);
  });
});