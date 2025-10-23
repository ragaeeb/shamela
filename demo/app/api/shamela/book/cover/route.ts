import { NextResponse } from 'next/server';

import { getCoverUrl } from '@/api';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Generates book cover URLs using the configured Shamela endpoints.
 */
export const runtime = 'nodejs';

/**
 * Calls {@link getCoverUrl} after ensuring the runtime configuration is initialised.
 *
 * @param request - The HTTP request containing the API key and book identifier
 * @returns A JSON structure containing the resolved cover URL or an error
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, id } = (await request.json()) as { apiKey: string; id: number };

        const data = await runWithShamelaConfig(apiKey, () => Promise.resolve({ url: getCoverUrl(id) }));

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
