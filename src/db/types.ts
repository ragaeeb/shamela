export type Author = {
    biography: string;
    death: number;
    id: number;
    name: string;
};

export type Book = {
    author: number;
    bibliography: string;
    category: number;
    date: number;
    hint: string;
    id: number;
    major: number;
    metadata: string;
    minor: number;
    name: string;
    pdf_links: string;
    printed: number;
    type: number;
};

export type Category = {
    id: number;
    name: string;
};

export enum Tables {
    Authors = 'authors',
    Books = 'books',
    Categories = 'categories',
    Page = 'page',
    Title = 'title',
}
