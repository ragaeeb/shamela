import type { AuthorRow, BookRow, CategoryRow, PageRow, TitleRow } from './db/types';

export type Author = AuthorRow;
export type Book = BookRow;
export type Category = CategoryRow;
export type Page = PageRow;
export type Title = TitleRow;

export type BookData = {
    pages: Page[];
    titles?: Title[];
};

export type MasterData = {
    authors: Author[];
    books: Book[];
    categories: Category[];
};

export type DownloadBookOptions = {
    bookMetadata?: GetBookMetadataResponsePayload;
    outputFile: OutputOptions;
};

export type DownloadMasterOptions = {
    masterMetadata?: GetMasterMetadataResponsePayload;
    outputFile: OutputOptions;
};

export type GetBookMetadataOptions = {
    majorVersion: number;
    minorVersion: number;
};

export type GetBookMetadataResponsePayload = {
    majorRelease: number;
    majorReleaseUrl: string;
    minorRelease?: number;
    minorReleaseUrl?: string;
};

export type GetMasterMetadataResponsePayload = {
    url: string;
    version: number;
};

export interface OutputOptions {
    path: string;
}
