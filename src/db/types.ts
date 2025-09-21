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

/**
 * A record that can be deleted by patches.
 */
export type Deletable = {
    /** Indicates if it was deleted in the patch if it is set to '1 */
    is_deleted: string;
};

export type Unique = {
    /** Unique identifier */
    id: number;
};

/**
 * Database row structure for the author table.
 */
export type AuthorRow = Deletable &
    Unique & {
        /** Author biography */
        biography: string;

        /** Death year */
        death_number: string;
        death_text: string;

        /** Author name */
        name: string;
    };

/**
 * Database row structure for the book table.
 */
export type BookRow = Deletable &
    Unique & {
        /** Serialized author ID(s) "2747, 3147" or "513" */
        author: string;

        /** Bibliography information */
        bibliography: string;

        /** Category ID */
        category: string;

        /** Publication date (or 99999 for unavailable) */
        date: string;

        /** Hint or description (nullable) */
        hint: string;

        /** Major version */
        major_release: string;

        /** Serialized metadata */
        metadata: string;

        /** Minor version */
        minor_release: string;

        /** Book name */
        name: string;

        /** Serialized PDF links (nullable) */
        pdf_links: string;

        /** Printed flag */
        printed: string;

        /** Book type */
        type: string;
    };

/**
 * Database row structure for the category table.
 */
export type CategoryRow = Deletable &
    Unique & {
        /** Category name */
        name: string;
        order: string;
    };

/**
 * Database row structure for the page table.
 */
export type PageRow = Deletable &
    Unique & {
        /** Page content */
        content: string;

        /** Page number (nullable) */
        number: string;

        /** Page reference (nullable) */
        page: string;

        /** Part number (nullable) */
        part: string;
        services: string;
    };

/**
 * Database row structure for the title table.
 */
export type TitleRow = Deletable &
    Unique & {
        /** Title content */
        content: string;

        /** Page number */
        page: string;

        /** Parent title ID (nullable) */
        parent: string;
    };
