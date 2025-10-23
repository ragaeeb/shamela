import { NextResponse } from 'next/server';

import { getBook } from '@/api';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Retrieves rendered book content for display in the demo UI.
 */
export const runtime = 'nodejs';

/**
 * Invokes {@link getBook} and returns a concise preview for the provided book identifier.
 *
 * @param request - The HTTP request carrying API credentials and book details
 * @returns A JSON payload with book statistics and content samples
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, id } = (await request.json()) as { apiKey: string; id: number };

        const data = await runWithShamelaConfig(apiKey, async () => {
            const book = await getBook(id);

            return {
                preview: {
                    pages: book.pages.slice(0, 3),
                    titles: book.titles.slice(0, 5),
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
