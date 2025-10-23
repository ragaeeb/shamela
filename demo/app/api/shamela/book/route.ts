import { NextResponse } from 'next/server';

import { getBook } from '@/api';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Retrieves rendered book content for display in the demo UI.
 */
export const runtime = 'nodejs';

const PREVIEW_PAGES_COUNT = 3;
const PREVIEW_TITLES_COUNT = 5;

/**
 * Invokes {@link getBook} and returns a concise preview for the provided book identifier.
 *
 * @param request - The HTTP request carrying API credentials and book details
 * @returns A JSON payload with book statistics and content samples
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, id } = (await request.json()) as { apiKey: string; id: number };

        if (typeof apiKey !== 'string' || !apiKey) {
            return NextResponse.json({ error: 'apiKey must be a non-empty string' }, { status: 400 });
        }

        if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: 'id must be a positive integer' }, { status: 400 });
        }

        const data = await runWithShamelaConfig(apiKey, async () => {
            const book = await getBook(id);

            return {
                preview: {
                    pages: book.pages.slice(0, PREVIEW_PAGES_COUNT),
                    titles: book.titles.slice(0, PREVIEW_TITLES_COUNT),
                },
                totals: {
                    pages: book.pages.length,
                    titles: book.titles.length,
                },
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
