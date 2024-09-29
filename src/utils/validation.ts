import path from 'path';
import process from 'process';

const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

export const validateEnvVariables = () => {
    if (!process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT) {
        throw new Error('SHAMELA_API_MASTER_PATCH_ENDPOINT environment variable not set');
    }

    if (!process.env.SHAMELA_API_KEY) {
        throw new Error('SHAMELA_API_KEY environment variable not set');
    }
};

export const validateMasterSourceTables = (sourceTablePaths: string[]) => {
    const sourceTableNames = sourceTablePaths.map((tablePath) => path.parse(tablePath).base);
    return SOURCE_TABLES.every((table) => sourceTableNames.includes(table));
};
