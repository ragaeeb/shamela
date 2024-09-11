export type GetMasterMetadataResponsePayload = {
    url: string;
    version: number;
};

export type GetBookMetadataResponsePayload = {
    majorReleaseUrl: string;
    minorReleaseUrl?: string;
    majorRelease: number;
    minorRelease?: number;
};

export interface OutputOptions {
    path: string;
}

export type DownloadMasterOptions = {
    outputDirectory: OutputOptions;
    masterMetadata?: GetMasterMetadataResponsePayload;
};

export type DownloadBookOptions = {
    outputFile: OutputOptions;
    bookMetadata?: GetBookMetadataResponsePayload;
};

export type GetBookMetadataOptions = {
    majorVersion: number;
    minorVersion: number;
};
