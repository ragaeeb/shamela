/**
 * Enumeration of database table names.
 */
export enum Tables {
    /** Authors table */
    Authors = 'authors',
    /** Books table */
    Books = 'books',
    /** Categories table */
    Categories = 'categories',
    /** Page table */
    Page = 'page',
    /** Title table */
    Title = 'title',
}

/**
 * Database row structure for authors table.
 */
export type AuthorRow = {
    /** Author biography */
    biography: string;
    /** Death year */
    death: number;
    /** Unique identifier */
    id: number;
    /** Author name */
    name: string;
};

/**
 * Database row structure for books table.
 */
export type BookRow = {
    /** Serialized author ID(s) */
    author: string;
    /** Bibliography information */
    bibliography: string;
    /** Category ID */
    category: number;
    /** Publication date (nullable) */
    date?: null | number;
    /** Hint or description (nullable) */
    hint: null | string;
    /** Unique identifier */
    id: number;
    /** Major version */
    major: number;
    /** Serialized metadata */
    metadata: string;
    /** Minor version */
    minor?: number;
    /** Book name */
    name: string;
    /** Serialized PDF links (nullable) */
    pdf_links: null | string;
    /** Printed flag */
    printed: number;
    /** Book type */
    type: number;
};

/**
 * Database row structure for categories table.
 */
export type CategoryRow = {
    /** Unique identifier */
    id: number;
    /** Category name */
    name: string;
};

/**
 * Database row structure for page table.
 */
export type PageRow = {
    /** Page content */
    content: string;
    /** Unique identifier */
    id: number;
    /** Page number (nullable) */
    number: null | number;
    /** Page reference (nullable) */
    page: null | number;
    /** Part number (nullable) */
    part: null | number;
};

/**
 * Database row structure for title table.
 */
export type TitleRow = {
    /** Title content */
    content: string;
    /** Unique identifier */
    id: number;
    /** Page number */
    page: number;
    /** Parent title ID (nullable) */
    parent: null | number;
};
