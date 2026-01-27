import type { Author, Book, Category, MasterData } from './types';
import { UNKNOWN_VALUE_PLACEHOLDER } from './utils/constants';

export type DenormalizedAuthor = Pick<Author, 'id' | 'name'> & { death?: number; biography?: string };

export type DenormalizedCategory = Pick<Category, 'id' | 'name'> & { order: number };

type PdfFile = { part?: string; name: string };

type PdfInfo = {
    alias?: number;
    files?: PdfFile[];
    cover?: number;
    cover_alias?: number;
    size?: number;
    root?: string;
    folder?: [number, string];
};

export type BookMetadata = {
    date: string;
    shorts?: Record<string, string>;
    prefix?: string;
    coauthor?: DenormalizedAuthor[];
    min_ver?: number;
    suffix?: string;
    group?: number;
    hide_diacritic?: boolean;
};

export type DenormalizedBook = Pick<Book, 'id' | 'bibliography' | 'name'> & {
    author: DenormalizedAuthor;
    date?: number;
    hint?: string;
    type?: number;
    category: DenormalizedCategory;
    pdf_links?: PdfInfo;
    printed: number;
    version: string;
    metadata: BookMetadata;
};

type StructureIndexes = {
    idToAuthor: Record<string, Author>;
    idToBook: Record<string, Book>;
    idToCategory: Record<string, Category>;
};

const pickTruthy = <T extends Record<string, any>, K extends keyof T>(obj: T, ...keys: K[]): Partial<Pick<T, K>> => {
    return Object.fromEntries(keys.map((key) => [key, obj[key]]).filter(([_, v]) => v)) as Partial<Pick<T, K>>;
};

const indexStructures = (master: MasterData): StructureIndexes => {
    const idToAuthor: Record<string, Author> = {};
    const idToBook: Record<string, Book> = {};
    const idToCategory: Record<string, Category> = {};

    master.authors.forEach((a) => {
        idToAuthor[a.id] = a;
    });

    master.books.forEach((a) => {
        idToBook[a.id] = a;
    });

    master.categories.forEach((a) => {
        idToCategory[a.id] = a;
    });

    return { idToAuthor, idToBook, idToCategory };
};

const denormalizeAuthor = (author: Author) => {
    return {
        id: author.id,
        name: author.name,
        ...(author.biography && { biography: author.biography }),
        ...(author.death_text && { death: Number(author.death_number) }),
    };
};

const denormalizeCategory = (category: Category) => {
    return {
        id: category.id,
        name: category.name,
        order: Number(category.order),
    };
};

const parseBookMetadata = (metadata: Record<string, any>, idToAuthor: Record<string, Author>): BookMetadata => {
    return {
        ...(metadata.coauthor && {
            coauthor: metadata.coauthor.map((id: number) => denormalizeAuthor(idToAuthor[id])),
        }),
        date: metadata.date,
        ...pickTruthy(metadata, 'group', 'hide_diacritic', 'min_ver', 'prefix', 'shorts', 'suffix'),
    };
};

const parsePdfLinks = (pdf: Record<string, any>): PdfInfo => {
    const files = (pdf.files || []).map((f: string) => {
        const [name, part] = f.split('|');
        return { ...(part && { part }), name };
    });

    return {
        ...pickTruthy(pdf, 'alias', 'cover', 'cover_alias', 'size', 'root', 'folder'),
        ...(files.length && { files }),
        ...(pdf.cover && { cover: pdf.cover }),
        ...(pdf.folder && { folder: pdf.folder }),
        ...(pdf.size && { size: pdf.size }),
    };
};

export const denormalizeBooks = (master: MasterData): DenormalizedBook[] => {
    const indexes = indexStructures(master);
    const result = master.books.map((book) => {
        const [author, ...coauthors] = book.author.split(/, ?/).map((a) => denormalizeAuthor(indexes.idToAuthor[a]));
        const metadata = parseBookMetadata(JSON.parse(book.metadata), indexes.idToAuthor);

        if (coauthors.length) {
            metadata.coauthor = (metadata.coauthor || []).concat(coauthors);
        }

        return {
            author,
            bibliography: book.bibliography,
            category: denormalizeCategory(indexes.idToCategory[book.category]),
            ...(book.date !== UNKNOWN_VALUE_PLACEHOLDER && { date: Number(book.date) }),
            ...(book.hint && { hint: book.hint }),
            id: book.id,
            metadata,
            name: book.name,
            ...(book.pdf_links && { pdf_links: parsePdfLinks(JSON.parse(book.pdf_links)) }),
            printed: Number(book.printed),
            version: `${book.major_release}.${book.minor_release}`,
        };
    });

    return result;
};
