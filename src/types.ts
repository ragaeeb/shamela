export type GetMasterMetadataResponsePayload = {
    url: string;
    version: number;
};

export interface OutputOptions {
    path: string;
}

export type DownloadMasterOptions = {
    outputDirectory: OutputOptions;
};
