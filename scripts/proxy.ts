const masterEndpointEnv = process.env.SHAMELA_API_MASTER_PATCH_ENDPOINT;
const booksEndpointEnv = process.env.SHAMELA_API_BOOKS_ENDPOINT;
const targetBase = process.env.SHAMELA_PROXY_TARGET ?? 'https://shamela.ws';
const port = Number.parseInt(process.env.PORT ?? '8787', 10);

const MASTER_PROXY_PATH = '/api/master_patch';
const BOOKS_PROXY_PATH = '/api/book_updates';
const CONFIG_PATH = '/__shamela/config';

/**
 * Static headers applied to every proxied response to allow cross-origin requests from Storybook.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
} as const;

/**
 * Mapping of local proxy paths to their upstream Shamela endpoints.
 */
const proxyRoutes = new Map<string, URL>();

/**
 * Registers a proxy route when the provided environment variable resolves to a valid URL.
 *
 * @param localPath - The path exposed by the local proxy server
 * @param envValue - The environment variable value pointing to the upstream endpoint
 */
const registerRoute = (localPath: string, envValue?: string) => {
    if (!envValue) {
        return;
    }

    try {
        proxyRoutes.set(localPath, new URL(envValue));
    } catch (error) {
        console.error(`Invalid URL for ${localPath}: ${(error as Error).message}`);
    }
};

registerRoute(MASTER_PROXY_PATH, masterEndpointEnv);
registerRoute(BOOKS_PROXY_PATH, booksEndpointEnv);

/**
 * Applies the configured CORS headers to a given {@link Headers} instance.
 *
 * @param headers - The headers object to mutate
 * @returns The provided headers instance with CORS headers applied
 */
const applyCors = (headers: Headers) => {
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    headers.set('Access-Control-Expose-Headers', headers.get('Access-Control-Expose-Headers') ?? '*');
    return headers;
};

/**
 * Derives the upstream URL for a given request by consulting the proxy route map and falling back
 * to the shared {@link targetBase} when no explicit mapping exists.
 *
 * @param requestUrl - The incoming request URL handled by the proxy server
 * @returns The resolved upstream URL that should handle the request
 */
const resolveUpstreamUrl = (requestUrl: URL) => {
    const mapped = proxyRoutes.get(requestUrl.pathname);
    if (mapped) {
        const upstream = new URL(mapped.toString());
        upstream.search = requestUrl.search;
        return upstream;
    }

    return new URL(requestUrl.pathname + requestUrl.search, targetBase);
};

/**
 * Generates the payload returned from the configuration endpoint, exposing the locally available
 * proxy URLs for Storybook to consume when configuring the client library.
 *
 * @param origin - The origin of the incoming request so absolute URLs can be constructed
 * @returns The configuration payload serialised as JSON
 */
const buildConfigResponse = (origin: string) => {
    const payload = {
        booksEndpoint: proxyRoutes.has(BOOKS_PROXY_PATH) ? new URL(BOOKS_PROXY_PATH, origin).toString() : null,
        masterEndpoint: proxyRoutes.has(MASTER_PROXY_PATH) ? new URL(MASTER_PROXY_PATH, origin).toString() : null,
    };

    const headers = applyCors(new Headers({ 'Content-Type': 'application/json' }));
    return new Response(JSON.stringify(payload), { headers });
};

const server = Bun.serve({
    port,
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: applyCors(new Headers()) });
        }

        const incomingUrl = new URL(request.url);

        if (incomingUrl.pathname === CONFIG_PATH) {
            return buildConfigResponse(incomingUrl.origin);
        }

        try {
            const upstreamUrl = resolveUpstreamUrl(incomingUrl);
            const headers = new Headers(request.headers);
            headers.delete('host');
            headers.set('Accept-Encoding', headers.get('Accept-Encoding') ?? 'identity');

            const upstreamResponse = await fetch(upstreamUrl, {
                body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
                headers,
                method: request.method,
            });

            const proxiedHeaders = applyCors(new Headers(upstreamResponse.headers));
            return new Response(upstreamResponse.body, {
                headers: proxiedHeaders,
                status: upstreamResponse.status,
                statusText: upstreamResponse.statusText,
            });
        } catch (error) {
            const headers = applyCors(new Headers());
            return new Response(`Proxy error: ${(error as Error).message}`, { headers, status: 502 });
        }
    },
});

const routeSummary = Array.from(proxyRoutes.entries())
    .map(([localPath, upstream]) => `${localPath} -> ${upstream.toString()}`)
    .join(', ');

const routeDescription = routeSummary ? ` with overrides: ${routeSummary}` : '';

console.log(
    `Shamela proxy running on http://localhost:${server.port} (forwarding to ${targetBase}${routeDescription})`,
);
