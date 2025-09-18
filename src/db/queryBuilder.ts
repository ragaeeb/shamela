/**
 * Generates SQL to attach a database file with an alias.
 * @param {string} dbFile - Path to the database file to attach
 * @param {string} alias - Alias name for the attached database
 * @returns {string} SQL ATTACH DATABASE statement
 */
export const attachDB = (dbFile: string, alias: string) => {
    const escapedPath = dbFile.replace(/'/g, "''");
    if (!/^[a-zA-Z0-9_]+$/.test(alias)) {
        throw new Error('Invalid database alias');
    }
    return `ATTACH DATABASE '${escapedPath}' AS ${alias}`;
};

/**
 * Generates SQL to create a table with specified fields.
 * @param {string} name - Name of the table to create
 * @param {string[]} fields - Array of field definitions
 * @returns {string} SQL CREATE TABLE statement
 */
export const createTable = (name: string, fields: string[]) => {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new Error('Invalid table name');
    }
    fields.forEach((field) => {
        if (field.includes(';') || field.includes('--')) {
            throw new Error('Invalid field definition');
        }
    });
    return `CREATE TABLE IF NOT EXISTS ${name} (${fields.join(', ')})`;
};

/**
 * Generates SQL to detach a database by alias.
 * @param {string} alias - Alias of the database to detach
 * @returns {string} SQL DETACH DATABASE statement
 */
export const detachDB = (alias: string) => {
    if (!/^[a-zA-Z0-9_]+$/.test(alias)) {
        throw new Error('Invalid database alias');
    }
    return `DETACH DATABASE ${alias}`;
};

/**
 * Generates an unsafe SQL INSERT statement with provided field values.
 * @param {string} table - Name of the table to insert into
 * @param {Record<string, any>} fieldToValue - Object mapping field names to values
 * @param {boolean} [isDeleted=false] - Whether to mark the record as deleted
 * @returns {string} SQL INSERT statement (unsafe - does not escape values properly)
 * @warning This function does not properly escape SQL values and should not be used with untrusted input
 */
export const insertUnsafely = (table: string, fieldToValue: Record<string, any>, isDeleted = false) => {
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
