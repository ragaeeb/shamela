const MAIN_DB_ALIAS = 'main';

export const createTable = (name: string, fields: string[]): string =>
    `CREATE TABLE IF NOT EXISTS ${name} (${fields.join(', ')})`;

export const attachDB = (dbFile: string, alias: string) => `ATTACH DATABASE '${dbFile}' AS ${alias}`;

export const detachDB = (alias: string) => `DETACH DATABASE ${alias}`;

const updatePageColumn = (columnName: string, aslAlias: string, patchAlias: string): string => `
  (SELECT CASE 
             WHEN ${patchAlias}.page.${columnName} != '#' THEN ${patchAlias}.page.${columnName}
             ELSE ${aslAlias}.page.${columnName}
           END 
    FROM ${patchAlias}.page
    WHERE ${aslAlias}.page.id = ${patchAlias}.page.id)
`;

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
