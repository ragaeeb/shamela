/**
 * Represents an author entity.
 */
export type Author = {
    /** Optional biography of the author */
    biography?: string;
    /** Death year of the author */
    death?: number;
    /** Unique identifier for the author */
    id: number;
    /** Name of the author */
    name: string;
};

/**
 * Represents a book entity.
 */
export type Book = {
    /** Author ID(s) associated with the book */
    author: number | number[];
    /** Bibliography information */
    bibliography: string;
    /** Category ID the book belongs to */
    category: number;
    /** Publication date */
    date?: number;
    /** Optional hint or description */
    hint?: string;
    /** Unique identifier for the book */
    id: number;
    /** Major version number */
    major: number;
    /** Metadata associated with the book */
    metadata: Metadata;
    /** Optional minor version number */
    minor?: number;
    /** Name/title of the book */
    name: string;
    /** Optional PDF download links */
    pdfLinks?: PDFLinks;
    /** Whether the book is printed (1) or not (0) */
    printed: number;
    /** Type classification of the book */
    type: number;
};

/**
 * Represents book content data.
 */
export type BookData = {
    /** Array of pages in the book */
    pages: Page[];
    /** Optional array of titles/chapters */
    titles?: Title[];
};

/**
 * Represents a category entity.
 */
export type Category = {
    /** Unique identifier for the category */
    id: number;
    /** Name of the category */
    name: string;
};

/**
 * Options for downloading a book.
 */
export type DownloadBookOptions = {
    /** Optional book metadata */
    bookMetadata?: GetBookMetadataResponsePayload;
    /** Output file configuration */
    outputFile: OutputOptions;
};

/**
 * Options for downloading master data.
 */
export type DownloadMasterOptions = {
    /** Optional master metadata */
    masterMetadata?: GetMasterMetadataResponsePayload;
    /** Output file configuration */
    outputFile: OutputOptions;
};

/**
 * Options for getting book metadata.
 */
export type GetBookMetadataOptions = {
    /** Major version number */
    majorVersion: number;
    /** Minor version number */
    minorVersion: number;
};

/**
 * Response payload for book metadata requests.
 */
export type GetBookMetadataResponsePayload = {
    /** Major release version */
    majorRelease: number;
    /** URL for major release download */
    majorReleaseUrl: string;
    /** Optional minor release version */
    minorRelease?: number;
    /** Optional URL for minor release download */
    minorReleaseUrl?: string;
};

/**
 * Response payload for master metadata requests.
 */
export type GetMasterMetadataResponsePayload = {
    /** Download URL */
    url: string;
    /** Version number */
    version: number;
};

/**
 * Master data structure containing all core entities.
 */
export type MasterData = {
    /** Array of all authors */
    authors: Author[];
    /** Array of all books */
    books: Book[];
    /** Array of all categories */
    categories: Category[];
};

/**
 * Metadata structure for books.
 */
export type Metadata = {
    /** Optional co-author IDs */
    coauthor?: number[];
    /** Date information */
    date: string;
    /** Optional group identifier */
    group?: number;
    /** Whether to hide diacritics */
    hide_diacritic?: boolean;
    /** Minimum version requirement */
    min_ver?: number;
    /** Optional prefix text */
    prefix?: string;
    /** Short codes mapping */
    shorts: Record<string, string>;
    /** Sub-book IDs */
    sub_books: number[];
    /** Optional suffix text */
    suffix?: string;
};

/**
 * Output file options.
 */
export interface OutputOptions {
    /** Output file path */
    path: string;
}

/**
 * Represents a page in a book.
 */
export type Page = {
    /** Content of the page */
    content: string;
    /** Unique identifier for the page */
    id: number;
    /** Optional page number */
    number?: number;
    /** Optional page reference */
    page?: number;
    /** Optional part number */
    part?: number;
};

/**
 * PDF links structure for books.
 */
export type PDFLinks = {
    /** Optional alias ID */
    alias?: number;
    /** Optional cover ID */
    cover?: number;
    /** Optional cover alias ID */
    cover_alias?: number;
    /** Optional array of PDF files */
    files?: PDFFile[];
    /** Optional root path */
    root?: string;
    /** Optional file size */
    size?: number;
};

/**
 * Represents a title or chapter heading.
 */
export type Title = {
    /** Content of the title */
    content: string;
    /** Unique identifier for the title */
    id: number;
    /** Page number where title appears */
    page: number;
    /** Optional parent title ID for hierarchical structure */
    parent?: number;
};

type PDFFile = {
    file: string;
    id?: string;
};
