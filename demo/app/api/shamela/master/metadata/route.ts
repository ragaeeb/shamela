import { NextResponse } from 'next/server';

import { getMasterMetadata } from '@/api';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Handles POST requests for retrieving master metadata via the demo API.
 */
export const runtime = 'nodejs';

/**
 * Processes metadata lookup requests by calling {@link getMasterMetadata}.
 *
 * @param request - The incoming request carrying credentials and the desired version
 * @returns A JSON response containing the metadata or an error description
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, version = 0 } = (await request.json()) as {
            apiKey: string;
            version?: number;
        };

        if (typeof apiKey !== 'string' || !apiKey) {
            return NextResponse.json({ error: 'apiKey must be a non-empty string' }, { status: 400 });
        }

        if (typeof version !== 'number' || version < 0) {
            return NextResponse.json({ error: 'version must be a non-negative number' }, { status: 400 });
        }

        const data = await runWithShamelaConfig(apiKey, () => getMasterMetadata(version));

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
