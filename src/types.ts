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

type PDFFile = {
    file: string;
    id?: string;
};

export type PDFLinks = {
    alias?: number;
    cover?: number;
    cover_alias?: number;
    files?: PDFFile[];
    root?: string;
    size?: number;
};

export type Metadata = {
    coauthor?: number[];
    date: string;
    group?: number;
    hide_diacritic?: boolean;
    min_ver?: number;
    prefix?: string;
    shorts: Record<string, string>;
    sub_books: number[];
    suffix?: string;
};

export type Book = {
    author: number | number[];
    bibliography: string;
    category: number;
    date?: number;
    hint?: string;
    id: number;
    major: number;
    metadata: Metadata;
    minor?: number;
    name: string;
    pdfLinks?: PDFLinks;
    printed: number;
    type: number;
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
