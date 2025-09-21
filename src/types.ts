import type { AuthorRow, BookRow, CategoryRow, PageRow, TitleRow } from './db/types';

/**
 * Represents an author entity.
 */
export type Author = AuthorRow;

/**
 * Represents a book entity.
 */
export type Book = BookRow;

/**
 * A category for a book.
 */
export type Category = CategoryRow;

/**
 * A page in a book.
 */
export type Page = Pick<PageRow, 'id' | 'content'> & {
    page?: number;
    part?: string;
    number?: string;
};

/**
 * A title heading in a book.
 */
export type Title = Pick<TitleRow, 'id' | 'content'> & {
    page: number;
    parent?: number;
};

/**
 * Represents book content data.
 */
export type BookData = {
    /** Array of pages in the book */
    pages: Page[];

    /** Array of titles/chapters */
    titles: Title[];
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
 * Output file options.
 */
export interface OutputOptions {
    /** Output file path */
    path: string;
}
