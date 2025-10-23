import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

import { downloadMasterDatabase } from '@/api';
import { createTempDir } from '@/utils/io';
import { runWithShamelaConfig, toErrorResponse } from '~/lib/shamela';

/**
 * Exposes {@link downloadMasterDatabase} via the demo API by persisting to a temporary file.
 */
export const runtime = 'nodejs';

/**
 * Streams the downloaded master database as JSON with helpful metadata.
 *
 * @param request - The HTTP request including the Shamela API key
 * @returns A JSON response describing the downloaded payload or an error
 */
export const POST = async (request: Request) => {
    try {
        const { apiKey } = (await request.json()) as { apiKey: string };

        const data = await runWithShamelaConfig(apiKey, async () => {
            const tempDir = await createTempDir('shamela-demo-master');
            const filePath = join(tempDir, 'master.json');

            try {
                await downloadMasterDatabase({
                    outputFile: { path: filePath },
                });

                const contents = await readFile(filePath, 'utf-8');
                const parsed = JSON.parse(contents) as {
                    version: number;
                    authors: unknown[];
                    books: unknown[];
                    categories: unknown[];
                };

                return {
                    filePath,
                    version: parsed.version,
                    totals: {
                        authors: parsed.authors.length,
                        books: parsed.books.length,
                        categories: parsed.categories.length,
                    },
                    preview: {
                        authors: parsed.authors.slice(0, 5),
                        books: parsed.books.slice(0, 5),
                        categories: parsed.categories.slice(0, 5),
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
