import { getConfig } from '@/config';

const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

/**
 * Validates that required environment variables are set.
 * @throws {Error} When any required environment variable is missing
 */
export const validateEnvVariables = () => {
    const { apiKey, booksEndpoint, masterPatchEndpoint } = getConfig();
    const envVariablesNotFound = [
        ['SHAMELA_API_KEY', apiKey],
        ['SHAMELA_API_BOOKS_ENDPOINT', booksEndpoint],
        ['SHAMELA_API_MASTER_PATCH_ENDPOINT', masterPatchEndpoint],
    ]
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (envVariablesNotFound.length) {
        throw new Error(`${envVariablesNotFound.join(', ')} environment variables not set`);
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
            .map((tablePath) => tablePath.split('/').pop()?.split('\\').pop() ?? tablePath)
            .map((name) => name.toLowerCase()),
    );
    return SOURCE_TABLES.every((table) => sourceTableNames.has(table.toLowerCase()));
};
