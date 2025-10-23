import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

import { downloadBook } from '@/api';
import { createTempDir } from '@/utils/io';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Bridges {@link downloadBook} into the demo through a simple JSON focused endpoint.
 */
export const runtime = 'nodejs';

/**
 * Downloads a book database to a temporary file and returns summary statistics.
 *
 * @param request - The HTTP request containing the Shamela credentials and desired book
 * @returns A JSON object with counts, a preview snippet, and the temp file path
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey, id } = (await request.json()) as { apiKey: string; id: number };

        const data = await runWithShamelaConfig(apiKey, async () => {
            const tempDir = await createTempDir('shamela-demo-book');
            const filePath = join(tempDir, `book-${id}.json`);

            try {
                await downloadBook(id, {
                    outputFile: { path: filePath },
                });

                const contents = await readFile(filePath, 'utf-8');
                const parsed = JSON.parse(contents) as {
                    pages: unknown[];
                    titles: unknown[];
                };

                return {
                    filePath,
                    totals: {
                        pages: parsed.pages.length,
                        titles: parsed.titles.length,
                    },
                    preview: {
                        pages: parsed.pages.slice(0, 3),
                        titles: parsed.titles.slice(0, 5),
                    },
                };
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: toErrorResponse(error) }, { status: 400 });
    }
};
