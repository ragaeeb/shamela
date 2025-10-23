import { getConfig, requireConfigValue } from '@/config';

/**
 * Builds a URL with query parameters and optional authentication.
 * @param {string} endpoint - The base endpoint URL
 * @param {Record<string, any>} queryParams - Object containing query parameters to append
 * @param {boolean} [useAuth=true] - Whether to include the API key from environment variables
 * @returns {URL} The constructed URL object with query parameters
 */
export const buildUrl = (endpoint: string, queryParams: Record<string, any>, useAuth: boolean = true): URL => {
    const url = new URL(endpoint);
    const params = new URLSearchParams();

    Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, value.toString());
    });

    if (useAuth) {
        params.append('api_key', requireConfigValue('apiKey'));
    }

    url.search = params.toString();

    return url;
};

/**
 * Makes an HTTPS GET request and returns the response data using the configured fetch implementation.
 * @template T - The expected return type (Buffer or Record<string, any>)
 * @param {string | URL} url - The URL to make the request to
 * @param options - Optional overrides including a custom fetch implementation
 * @returns {Promise<T>} A promise that resolves to the response data, parsed as JSON if content-type is application/json, otherwise as Buffer
 * @throws {Error} When the request fails or JSON parsing fails
 */
export const httpsGet = async <T extends Uint8Array | Record<string, any>>(
    url: string | URL,
    options: { fetchImpl?: typeof fetch } = {},
): Promise<T> => {
    const target = typeof url === 'string' ? url : url.toString();
    const activeFetch = options.fetchImpl ?? getConfig().fetchImplementation ?? fetch;
    const response = await activeFetch(target);

    if (!response.ok) {
        throw new Error(`Error making request: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
        return (await response.json()) as T;
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer) as T;
};
