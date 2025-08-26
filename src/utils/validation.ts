import path from 'node:path';
import process from 'node:process';

const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

/**
 * Validates that required environment variables are set.
 * @throws {Error} When any required environment variable is missing
 */
export const validateEnvVariables = () => {
    const envVariableNotFound = [
        'SHAMELA_API_MASTER_PATCH_ENDPOINT',
        'SHAMELA_API_BOOKS_ENDPOINT',
        'SHAMELA_API_KEY',
    ].find((key) => !process.env[key]);

    if (envVariableNotFound) {
        throw new Error(`${envVariableNotFound} environment variable not set`);
    }
};

/**
 * Validates that all required master source tables are present in the provided paths.
 * @param {string[]} sourceTablePaths - Array of file paths to validate
 * @returns {boolean} True if all required source tables (author.sqlite, book.sqlite, category.sqlite) are present
 */
export const validateMasterSourceTables = (sourceTablePaths: string[]) => {
    const sourceTableNames = sourceTablePaths.map((tablePath) => path.parse(tablePath).base);
    return SOURCE_TABLES.every((table) => sourceTableNames.includes(table));
};
