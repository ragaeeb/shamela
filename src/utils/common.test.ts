import { describe, expect, it } from 'bun:test';

import { mapPageRowToPage, mapTitleRowToTitle, redactUrl } from './common';

const createUrl = (value: string) => `https://example.com/resource?api_key=${value}&query=test`;

describe('common helpers', () => {
    it('redactUrl obscures sensitive query parameters', () => {
        const url = createUrl('abcdef123456');
        const redacted = redactUrl(url);

        expect(redacted).toContain('api_key=abc***456');
        expect(redacted.startsWith('https://example.com/resource?')).toBeTrue();
    });

    it('mapPageRowToPage normalises numeric fields', () => {
        const page = mapPageRowToPage({
            content: 'Content',
            id: 5,
            is_deleted: '0',
            number: '12',
            page: '34',
            part: 'Part',
            services: null,
        });

        expect(page).toEqual({ content: 'Content', id: 5, number: '12', page: 34, part: 'Part' });
    });

    it('mapTitleRowToTitle converts parent and page to numbers when present', () => {
        const title = mapTitleRowToTitle({
            content: 'Heading',
            id: 9,
            is_deleted: '0',
            page: '7',
            parent: '3',
        });

        expect(title).toEqual({ content: 'Heading', id: 9, page: 7, parent: 3 });
    });

    it('mapTitleRowToTitle omits falsy parent identifiers', () => {
        const title = mapTitleRowToTitle({
            content: 'Heading',
            id: 9,
            is_deleted: '0',
            page: '7',
            parent: '0',
        });

        expect(title).toEqual({ content: 'Heading', id: 9, page: 7 });
    });
});
