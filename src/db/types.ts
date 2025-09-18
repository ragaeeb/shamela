/**
 * Enumeration of database table names.
 */
export enum Tables {
    /** Author table */
    Authors = 'author',
    /** Book table */
    Books = 'book',
    /** Category table */
    Categories = 'category',
    /** Page table */
    Page = 'page',
    /** Title table */
    Title = 'title',
}

type SQLiteValue = number | string | null;

/**
 * Database row structure for the author table.
 */
export type AuthorRow = {
    biography: SQLiteValue;
    death_number: SQLiteValue;
    death_text: SQLiteValue;
    id: number;
    is_deleted: SQLiteValue;
    name: SQLiteValue;
};

/**
 * Database row structure for the book table.
 */
export type BookRow = {
    author: SQLiteValue;
    bibliography: SQLiteValue;
    category: SQLiteValue;
    date: SQLiteValue;
    hint: SQLiteValue;
    id: number;
    is_deleted: SQLiteValue;
    major_release: SQLiteValue;
    metadata: SQLiteValue;
    minor_release: SQLiteValue;
    name: SQLiteValue;
    pdf_links: SQLiteValue;
    printed: SQLiteValue;
    type: SQLiteValue;
};

/**
 * Database row structure for the category table.
 */
export type CategoryRow = {
    id: number;
    is_deleted: SQLiteValue;
    name: SQLiteValue;
    order: SQLiteValue;
};

/**
 * Database row structure for the page table.
 */
export type PageRow = {
    content: SQLiteValue;
    id: number;
    is_deleted: SQLiteValue;
    number: SQLiteValue;
    page: SQLiteValue;
    part: SQLiteValue;
    services: SQLiteValue;
};

/**
 * Database row structure for the title table.
 */
export type TitleRow = {
    content: SQLiteValue;
    id: number;
    is_deleted: SQLiteValue;
    page: SQLiteValue;
    parent: SQLiteValue;
};
