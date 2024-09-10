export type Author = {
    id: number;
    name: string;
    biography: string;
    death: number;
};

export type Book = {
    id: number;
    name: string;
    category: number;
    type: number;
    date: number;
    author: number;
    printed: number;
    major: number;
    minor: number;
    bibliography: string;
    hint: string;
    pdf_links: string;
    metadata: string;
};

export type Category = {
    id: number;
    name: string;
};

export enum Tables {
    Authors = 'authors',
    Books = 'books',
    Categories = 'categories',
}
