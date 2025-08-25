const MAIN_DB_ALIAS = 'main';

/**
 * Generates SQL to attach a database file with an alias.
 * @param {string} dbFile - Path to the database file to attach
 * @param {string} alias - Alias name for the attached database
 * @returns {string} SQL ATTACH DATABASE statement
 */
export const attachDB = (dbFile: string, alias: string) => `ATTACH DATABASE '${dbFile}' AS ${alias}`;

/**
 * Builds a SQL query to patch page data from one database to another.
 * @param {string} patchAlias - Alias of the patch database
 * @param {string} tableName - Name of the table to update
 * @param {string} [aslAlias='main'] - Alias of the main database
 * @returns {string} SQL UPDATE statement for patching page data
 */
export const buildPagePatchQuery = (
    patchAlias: string,
    tableName: string,
    aslAlias: string = MAIN_DB_ALIAS,
): string => `
  UPDATE ${aslAlias}.${tableName}
  SET content = ${updatePageColumn('content', aslAlias, patchAlias)},
      part = ${updatePageColumn('part', aslAlias, patchAlias)},
      page = ${updatePageColumn('page', aslAlias, patchAlias)},
      number = ${updatePageColumn('number', aslAlias, patchAlias)}
  WHERE EXISTS (
    SELECT 1
    FROM ${patchAlias}.${tableName}
    WHERE ${aslAlias}.${tableName}.id = ${patchAlias}.${tableName}.id
  );
`;

const updateTitleColumn = (columnName: string, aslAlias: string, patchAlias: string) => `
  (SELECT CASE 
             WHEN ${patchAlias}.title.${columnName} != '#' THEN ${patchAlias}.title.${columnName}
             ELSE ${aslAlias}.title.${columnName}
           END 
    FROM ${patchAlias}.title
    WHERE ${aslAlias}.title.id = ${patchAlias}.title.id)
`;

/**
 * Builds a SQL query to patch title data from one database to another.
 * @param {string} patchAlias - Alias of the patch database
 * @param {string} tableName - Name of the table to update
 * @param {string} [aslAlias='main'] - Alias of the main database
 * @returns {string} SQL UPDATE statement for patching title data
 */
export const buildTitlePatchQuery = (
    patchAlias: string,
    tableName: string,
    aslAlias: string = MAIN_DB_ALIAS,
): string => `
  UPDATE ${aslAlias}.${tableName}
  SET content = ${updateTitleColumn('content', aslAlias, patchAlias)},
      page = ${updateTitleColumn('page', aslAlias, patchAlias)},
      parent = ${updateTitleColumn('parent', aslAlias, patchAlias)}
  WHERE EXISTS (
    SELECT 1
    FROM ${patchAlias}.${tableName}
    WHERE ${aslAlias}.${tableName}.id = ${patchAlias}.${tableName}.id
  );
`;

/**
 * Generates SQL to create a table with specified fields.
 * @param {string} name - Name of the table to create
 * @param {string[]} fields - Array of field definitions
 * @returns {string} SQL CREATE TABLE statement
 */
export const createTable = (name: string, fields: string[]): string =>
    `CREATE TABLE IF NOT EXISTS ${name} (${fields.join(', ')})`;

/**
 * Generates SQL to detach a database by alias.
 * @param {string} alias - Alias of the database to detach
 * @returns {string} SQL DETACH DATABASE statement
 */
export const detachDB = (alias: string) => `DETACH DATABASE ${alias}`;

const updatePageColumn = (columnName: string, aslAlias: string, patchAlias: string): string => `
  (SELECT CASE 
             WHEN ${patchAlias}.page.${columnName} != '#' THEN ${patchAlias}.page.${columnName}
             ELSE ${aslAlias}.page.${columnName}
           END 
    FROM ${patchAlias}.page
    WHERE ${aslAlias}.page.id = ${patchAlias}.page.id)
`;

/**
 * Generates an unsafe SQL INSERT statement with provided field values.
 * @param {string} table - Name of the table to insert into
 * @param {Record<string, any>} fieldToValue - Object mapping field names to values
 * @param {boolean} [isDeleted=false] - Whether to mark the record as deleted
 * @returns {string} SQL INSERT statement (unsafe - does not escape values properly)
 * @warning This function does not properly escape SQL values and should not be used with untrusted input
 */
export const insertUnsafely = (table: string, fieldToValue: Record<string, any>, isDeleted = false): string => {
    const combinedRecords: Record<string, any> = { ...fieldToValue, is_deleted: isDeleted ? '1' : '0' };

    const sortedKeys = Object.keys(combinedRecords).sort();

    const sortedValues = sortedKeys.map((key) => combinedRecords[key]);

    return `INSERT INTO ${table} (${sortedKeys.toString()}) VALUES (${sortedValues
        .map((val) => {
            if (val === null) {
                return 'NULL';
            }

            return typeof val === 'string' ? `'${val}'` : val;
        })
        .toString()})`;
};
