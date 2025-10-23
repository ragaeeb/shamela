import { configure, resetConfig } from '@/config';
import type { ConfigureOptions } from '@/config';

/**
 * Resolves the base Shamela configuration derived from environment variables.
 *
 * @throws {Error} When required endpoints are not defined
 * @returns The configuration options that can be merged with runtime overrides
 */
const resolveBaseConfig = (): ConfigureOptions => {
    const booksEndpoint = process.env.SHAMELA_API_BOOKS_ENDPOINT;
    const masterPatchEndpoint = process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT;
    const sqlJsWasmUrl = process.env.SHAMELA_SQLJS_WASM_URL;

    if (!booksEndpoint || !masterPatchEndpoint) {
        throw new Error('Set SHAMELA_API_BOOKS_ENDPOINT and SHAMELA_API_MASTER_PATCH_ENDPOINT to use the demo.');
    }

    return {
        booksEndpoint,
        masterPatchEndpoint,
        ...(sqlJsWasmUrl ? { sqlJsWasmUrl } : {}),
    } satisfies ConfigureOptions;
};

/**
 * Executes a Shamela library operation using request supplied credentials.
 *
 * @typeParam TResult - The resolved result type for the operation
 * @param apiKey - API key supplied by the demo user
 * @param runner - Callback that performs the Shamela operation
 * @returns The result of the provided runner
 */
export const runWithShamelaConfig = async <TResult>(
    apiKey: string,
    runner: () => Promise<TResult>,
): Promise<TResult> => {
    if (!apiKey) {
        throw new Error('An API key must be provided to call the Shamela services.');
    }

    const baseConfig = resolveBaseConfig();

    configure({ ...baseConfig, apiKey });

    try {
        return await runner();
    } finally {
        resetConfig();
    }
};

/**
 * Creates an error payload suitable for API responses.
 *
 * @param error - The thrown error or unknown value
 * @returns A serialisable error structure for the client
 */
export const toErrorResponse = (error: unknown) => {
    if (error instanceof Error) {
        return { message: error.message };
    }

    return { message: 'Unexpected error occurred' };
};
