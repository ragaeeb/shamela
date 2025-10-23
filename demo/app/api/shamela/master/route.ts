import { NextResponse } from 'next/server';

import { getMaster } from '@/api';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Enables retrieval of the in-memory master snapshot through the demo API.
 */
export const runtime = 'nodejs';

/**
 * Calls {@link getMaster} and returns a trimmed payload for readability.
 *
 * @param request - The HTTP request carrying authentication details
 * @returns A JSON payload with master data or an error structure
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey } = (await request.json()) as { apiKey: string };

        const data = await runWithShamelaConfig(apiKey, async () => {
            const master = await getMaster();

            return {
                version: master.version,
                totals: {
                    authors: master.authors.length,
                    books: master.books.length,
                    categories: master.categories.length,
                },
                preview: {
                    authors: master.authors.slice(0, 5),
                    books: master.books.slice(0, 5),
                    categories: master.categories.slice(0, 5),
                },
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
