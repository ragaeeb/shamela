export type GetMasterMetadataResponsePayload = {
    url: string;
    version: number;
};

export type GetBookMetadataResponsePayload = {
    majorRelease: number;
    majorReleaseUrl: string;
    minorRelease?: number;
    minorReleaseUrl?: string;
};

export interface OutputOptions {
    path: string;
}

export type DownloadMasterOptions = {
    masterMetadata?: GetMasterMetadataResponsePayload;
    outputFile: OutputOptions;
};

export type DownloadBookOptions = {
    bookMetadata?: GetBookMetadataResponsePayload;
    outputFile: OutputOptions;
};

export type GetBookMetadataOptions = {
    majorVersion: number;
    minorVersion: number;
};
