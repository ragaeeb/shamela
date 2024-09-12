const MAIN_DB_ALIAS = 'main';

export const createTable = (name: string, fields: string[]) =>
    `CREATE TABLE IF NOT EXISTS ${name} (${fields.join(', ')})`;

export const attachDB = (dbFile: string, alias: string) => `ATTACH DATABASE '${dbFile}' AS ${alias}`;

const updatePageColumn = (columnName: string, aslAlias: string, patchAlias: string) => `
  (SELECT CASE 
             WHEN ${patchAlias}.page.${columnName} != '#' THEN ${patchAlias}.page.${columnName}
             ELSE ${aslAlias}.page.${columnName}
           END 
    FROM ${patchAlias}.page
    WHERE ${aslAlias}.page.id = ${patchAlias}.page.id)
`;

export const buildPagePatchQuery = (patchAlias: string, tableName: string, aslAlias: string = MAIN_DB_ALIAS) => `
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

export const buildRemoveDeletedQuery = (patchAlias: string, tableName: string, aslAlias: string = MAIN_DB_ALIAS) =>
    `DELETE FROM ${aslAlias}.${tableName} WHERE id IN (SELECT id FROM ${patchAlias}.${tableName} WHERE is_deleted='1')`;

const updateTitleColumn = (columnName: string, aslAlias: string, patchAlias: string) => `
  (SELECT CASE 
             WHEN ${patchAlias}.title.${columnName} != '#' THEN ${patchAlias}.title.${columnName}
             ELSE ${aslAlias}.title.${columnName}
           END 
    FROM ${patchAlias}.title
    WHERE ${aslAlias}.title.id = ${patchAlias}.title.id)
`;

export const buildTitlePatchQuery = (patchAlias: string, tableName: string, aslAlias: string = MAIN_DB_ALIAS) => `
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
