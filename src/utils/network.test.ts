import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';

type NetworkModule = typeof import('./network.ts');

let buildUrl: NetworkModule['buildUrl'];
let httpsGet: NetworkModule['httpsGet'];

describe('network utilities', () => {
    beforeAll(async () => {
        const actualNetworkModule = await import('./network.ts');
        ({ buildUrl, httpsGet } = actualNetworkModule);
    });

    beforeEach(() => {
        process.env.SHAMELA_API_KEY = 'test-key';
    });

    afterEach(() => {
        delete process.env.SHAMELA_API_KEY;
    });

    it('buildUrl appends query parameters and API key by default', () => {
        const url = buildUrl('https://example.com/items', { page: 2 });
        expect(url.toString()).toBe('https://example.com/items?page=2&api_key=test-key');
    });

    it('buildUrl skips API key when useAuth is false', () => {
        const url = buildUrl('https://example.com/items', { page: 2 }, false);
        expect(url.toString()).toBe('https://example.com/items?page=2');
    });

    it('httpsGet parses JSON responses automatically', async () => {
        let called = 0;
        const fetchImpl: typeof fetch = async () => {
            called += 1;
            return new Response(JSON.stringify({ ok: true }), {
                headers: { 'content-type': 'application/json' },
                status: 200,
            });
        };

        const result = await httpsGet<{ ok: boolean }>('https://example.com/data', {
            fetchImpl,
        });
        expect(called).toBe(1);
        expect(result).toEqual({ ok: true });
    });

    it('httpsGet returns binary data when content type is not JSON', async () => {
        const payload = new Uint8Array([1, 2, 3]);
        let called = 0;
        const fetchImpl: typeof fetch = async () => {
            called += 1;
            return new Response(payload, { status: 200 });
        };

        const result = await httpsGet<Uint8Array>('https://example.com/data.bin', {
            fetchImpl,
        });
        expect(Array.from(result)).toEqual([1, 2, 3]);
        expect(called).toBe(1);
        expect(result).toBeInstanceOf(Uint8Array);
    });

    it('httpsGet throws when the response is not successful', async () => {
        let called = 0;
        const fetchImpl: typeof fetch = async () => {
            called += 1;
            return new Response('Error', { status: 500, statusText: 'Server Error' });
        };

        await expect(
            httpsGet('https://example.com/failure', {
                fetchImpl,
            }),
        ).rejects.toThrow('Error making request: 500 Server Error');
        expect(called).toBe(1);
    });
});
