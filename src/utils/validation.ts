import path from 'path';

const SOURCE_TABLES = ['author.sqlite', 'book.sqlite', 'category.sqlite'];

export const validateMasterSourceTables = (sourceTablePaths: string[]) => {
    const sourceTableNames = sourceTablePaths.map((tablePath) => path.parse(tablePath).base);
    return SOURCE_TABLES.every((table) => sourceTableNames.includes(table));
};
