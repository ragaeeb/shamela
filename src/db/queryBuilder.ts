export const createTable = (name: string, fields: string[]) =>
    `CREATE TABLE IF NOT EXISTS ${name} (${fields.join(', ')})`;

export const attachDB = (dbFile: string, alias: string) => `ATTACH DATABASE '${dbFile}' AS ${alias}`;
