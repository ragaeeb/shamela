import { beforeEach, describe, expect, it } from 'bun:test';

import { denormalizeBooks } from './transform';
import type { Author, Category } from './types';

describe('denormalizeBooks', () => {
    let category: Category;
    let author: Author;

    beforeEach(() => {
        category = {
            id: 23,
            is_deleted: '0',
            name: 'الرقائق والآداب والأذكار',
            order: '23',
        };

        author = {
            biography: 'Bio',
            death_number: '751',
            death_text: '751',
            id: 14,
            is_deleted: '0',
            name: 'ابن القيم',
        };
    });

    it('should handle cover_alias', () => {
        const book = {
            author: '14',
            bibliography: 'B',
            category: '23',
            date: '751',
            hint: null,
            id: 11797,
            is_deleted: '0',
            major_release: '3',
            metadata: '{"date": "06091442", "min_ver": 2, "prefix": "رسالة ابن القيم إلى أحد إخوانه", "group": 6666}',
            minor_release: '0',
            name: 'N',
            pdf_links:
                '{"cover_alias": 14211, "root": "https://archive.org/download/rqikw/", "files": ["rqikw_p.pdf|المقدمة", "rqikw.pdf|0"], "size": 1292569}',
            printed: '1',
            type: '1',
        };

        const actual = denormalizeBooks({ authors: [author], books: [book], categories: [category], version: 0 });

        expect(actual).toEqual([
            {
                author: { biography: 'Bio', death: 751, id: 14, name: 'ابن القيم' },
                bibliography: 'B',
                category: { id: 23, name: 'الرقائق والآداب والأذكار', order: 23 },
                date: 751,
                id: 11797,
                metadata: { date: '06091442', group: 6666, min_ver: 2, prefix: 'رسالة ابن القيم إلى أحد إخوانه' },
                name: 'N',
                pdf_links: {
                    cover_alias: 14211,
                    files: [
                        { name: 'rqikw_p.pdf', part: 'المقدمة' },
                        { name: 'rqikw.pdf', part: '0' },
                    ],
                    root: 'https://archive.org/download/rqikw/',
                    size: 1292569,
                },
                printed: 1,
                version: '3.0',
            },
        ]);
    });

    it('should handle coauthors', () => {
        const book = {
            author: '14',
            bibliography: 'B',
            category: '23',
            date: '275',
            hint: null,
            id: 6785,
            is_deleted: '0',
            major_release: '1',
            metadata: '{"date": "08121431", "coauthor": [14]}',
            minor_release: '1',
            name: 'الورع - المروذي',
            pdf_links: null,
            printed: '1',
            type: '1',
        };

        const actual = denormalizeBooks({ authors: [author], books: [book], categories: [category], version: 0 });

        expect(actual).toEqual([
            {
                author: { biography: 'Bio', death: 751, id: 14, name: 'ابن القيم' },
                bibliography: 'B',
                category: { id: 23, name: 'الرقائق والآداب والأذكار', order: 23 },
                date: 275,
                id: 6785,
                metadata: { coauthor: [{ biography: 'Bio', death: 751, id: 14, name: 'ابن القيم' }], date: '08121431' },
                name: 'الورع - المروذي',
                printed: 1,
                version: '1.1',
            },
        ]);
    });

    it('should handle prefix and suffix', () => {
        const book = {
            author: '14',
            bibliography: 'B',
            category: '23',
            date: '902',
            hint: null,
            id: 7434,
            is_deleted: '0',
            major_release: '3',
            metadata:
                '{"date": "08121431", "prefix": "التحفة اللطيفة in تاريخ المدينة الشريفة", "suffix": "ط العلمية", "group": 7434, "hide_diacritic": true}',
            minor_release: '0',
            name: 'التحفة اللطيفة في تاريخ المدينة الشريفة - ط العلمية',
            pdf_links:
                '{"root": "https://archive.org/download/thfltfa_elmiya/", "files": ["00_72777.pdf", "01_72777.pdf", "02_72778.pdf"], "size": 19762479, "cover": 1}',
            printed: '1',
            type: '1',
        };

        const actual = denormalizeBooks({ authors: [author], books: [book], categories: [category], version: 0 });

        expect(actual).toEqual([
            {
                author: { biography: 'Bio', death: 751, id: 14, name: 'ابن القيم' },
                bibliography: 'B',
                category: { id: 23, name: 'الرقائق والآداب والأذكار', order: 23 },
                date: 902,
                id: 7434,
                metadata: {
                    date: '08121431',
                    group: 7434,
                    hide_diacritic: true,
                    prefix: 'التحفة اللطيفة in تاريخ المدينة الشريفة',
                    suffix: 'ط العلمية',
                },
                name: 'التحفة اللطيفة في تاريخ المدينة الشريفة - ط العلمية',
                pdf_links: {
                    cover: 1,
                    files: [{ name: '00_72777.pdf' }, { name: '01_72777.pdf' }, { name: '02_72778.pdf' }],
                    root: 'https://archive.org/download/thfltfa_elmiya/',
                    size: 19762479,
                },
                printed: 1,
                version: '3.0',
            },
        ]);
    });

    it('should handle unknown date placeholder, hints, and missing author info', () => {
        const minimalAuthor = {
            id: 15,
            is_deleted: '0',
            name: 'Minimal Author',
        } as any;

        const book = {
            author: '15',
            category: '23',
            date: '99999',
            hint: 'Some hint',
            id: 123,
            is_deleted: '0',
            major_release: '1',
            metadata: '{"date": "20230101"}',
            minor_release: '2',
            name: 'Minimal Book',
            printed: '0',
        };

        const actual = denormalizeBooks({
            authors: [minimalAuthor],
            books: [book as any],
            categories: [category],
            version: 0,
        });

        expect(actual[0].date).toBeUndefined();
        expect(actual[0].hint).toBe('Some hint');
        expect(actual[0].author).toEqual({ id: 15, name: 'Minimal Author' });
        expect(actual[0].version).toBe('1.2');
        expect(actual[0].id).toBe(123);
    });

    it('should handle complex pdf info and metadata shorts', () => {
        const book = {
            author: '14',
            category: '23',
            id: 456,
            major_release: '1',
            metadata: '{"date": "20230101", "shorts": {"key": "value"}}',
            minor_release: '0',
            name: 'Complex PDF Book',
            pdf_links: '{"alias": 123, "folder": [1, "path"], "files": ["file.pdf"]}',
            printed: '1',
        };

        const actual = denormalizeBooks({
            authors: [author],
            books: [book as any],
            categories: [category],
            version: 0,
        });

        expect(actual[0].metadata.shorts).toEqual({ key: 'value' });
        expect(actual[0].pdf_links).toEqual({
            alias: 123,
            files: [{ name: 'file.pdf' }],
            folder: [1, 'path'],
        });
        expect(actual[0].id).toBe(456);
    });

    it('should handle comma-separated authors in book.author', () => {
        const author2 = {
            id: 15,
            is_deleted: '0',
            name: 'Author 2',
        };

        const book = {
            author: '14, 15',
            category: '23',
            id: 123,
            major_release: '1',
            metadata: '{"date": "20230101"}',
            minor_release: '0',
            name: 'Multi-Author Book',
            printed: '1',
        };

        const actual = denormalizeBooks({
            authors: [author, author2] as any,
            books: [book as any],
            categories: [category],
            version: 0,
        });

        expect(actual[0].author.id).toBe(14);
        expect(actual[0].metadata.coauthor).toHaveLength(1);
        expect(actual[0].metadata.coauthor![0].id).toBe(15);
    });

    it('should merge comma-separated authors with existing coauthors in metadata', () => {
        const author2 = {
            id: 15,
            is_deleted: '0',
            name: 'Author 2',
        };
        const author3 = {
            id: 16,
            is_deleted: '0',
            name: 'Author 3',
        };

        const book = {
            author: '14,15',
            category: '23',
            id: 123,
            major_release: '1',
            metadata: '{"date": "20230101", "coauthor": [16]}',
            minor_release: '0',
            name: 'Multi-Author Book',
            printed: '1',
        };

        const actual = denormalizeBooks({
            authors: [author, author2, author3] as any,
            books: [book as any],
            categories: [category],
            version: 0,
        });

        expect(actual[0].author.id).toBe(14);
        expect(actual[0].metadata.coauthor).toHaveLength(2);
        expect(actual[0].metadata.coauthor![0].id).toBe(16);
        expect(actual[0].metadata.coauthor![1].id).toBe(15);
    });
});
