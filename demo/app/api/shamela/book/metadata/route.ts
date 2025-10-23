import { NextResponse } from 'next/server';

import { getBookMetadata } from '@/api';
import type { GetBookMetadataOptions } from '@/types';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Serves book metadata lookups for the demo UI.
 */
export const runtime = 'nodejs';

/**
 * Calls {@link getBookMetadata} with optional version overrides provided by the client.
 *
 * @param request - The HTTP request carrying API credentials and the target book identifier
 * @returns A JSON response describing the available releases or an error structure
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, id, majorVersion, minorVersion } = (await request.json()) as {
            apiKey: string;
            id: number;
            majorVersion?: number;
            minorVersion?: number;
        };

        let versionOverrides: GetBookMetadataOptions | undefined;

        if (majorVersion !== undefined || minorVersion !== undefined) {
            versionOverrides = {} as GetBookMetadataOptions;

            if (majorVersion !== undefined) {
                versionOverrides.majorVersion = majorVersion;
            }

            if (minorVersion !== undefined) {
                versionOverrides.minorVersion = minorVersion;
            }
        }

        const data = await runWithShamelaConfig(apiKey, () => getBookMetadata(id, versionOverrides));

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
