import { getConfig } from '@/config';

const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

/**
 * Validates that the API key is configured.
 *
 * Note: The `booksEndpoint` and `masterPatchEndpoint` are validated lazily
 * when the corresponding API functions are called. This allows clients to
 * configure only the endpoint they need (e.g., only `booksEndpoint` if they
 * only use book APIs).
 *
 * @throws {Error} When the API key is not configured
 */
export const validateEnvVariables = () => {
    const { apiKey } = getConfig();

    if (!apiKey) {
        throw new Error('apiKey environment variable not set');
    }
};

/**
 * Validates that all required master source tables are present in the provided paths.
 * @param {string[]} sourceTablePaths - Array of file paths to validate
 * @returns {boolean} True if all required source tables (author.sqlite, book.sqlite, category.sqlite) are present
 */
export const validateMasterSourceTables = (sourceTablePaths: string[]) => {
    const sourceTableNames = new Set(
        sourceTablePaths
            .map((tablePath) => tablePath.match(/[^\\/]+$/)?.[0] ?? tablePath)
            .map((name) => name.toLowerCase()),
    );
    return SOURCE_TABLES.every((table) => sourceTableNames.has(table.toLowerCase()));
};
