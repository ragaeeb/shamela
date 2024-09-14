import { Book } from './book';

export type GetMasterMetadataResponsePayload = {
    url: string;
    version: number;
};

export interface OutputOptions {
    path: string;
}

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

export interface OutputBookOptions extends OutputOptions {
    removeHeaderTags?: boolean;
}

export type DownloadBookOptions = {
    bookMetadata?: GetBookMetadataResponsePayload;
    outputFile: OutputBookOptions;
    preventCleanup?: boolean;
};

export type Author = {
    biography?: string;
    death?: number;
    id: number;
    name: string;
};

export type Category = {
    id: number;
    name: string;
};

export type MasterData = {
    authors: Author[];
    books: Book[];
    categories: Category[];
};

export type Page = {
    content: string;
    id: number;
    number?: number;
    page?: number;
    part?: number;
};

export type Title = {
    content: string;
    id: number;
    page: number;
    parent?: number;
};

export type BookData = {
    pages: Page[];
    titles?: Title[];
};
