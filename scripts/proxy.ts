const targetBase = process.env.SHAMELA_PROXY_TARGET ?? 'https://shamela.ws';
const port = Number.parseInt(process.env.PORT ?? '8787', 10);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
} as const;

const applyCors = (headers: Headers) => {
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    headers.set('Access-Control-Expose-Headers', headers.get('Access-Control-Expose-Headers') ?? '*');
    return headers;
};

const server = Bun.serve({
    port,
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: applyCors(new Headers()) });
        }

        const incomingUrl = new URL(request.url);
        const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, targetBase);

        try {
            const headers = new Headers(request.headers);
            headers.delete('host');

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

console.log(`Shamela proxy running on http://localhost:${server.port} (forwarding to ${targetBase})`);
