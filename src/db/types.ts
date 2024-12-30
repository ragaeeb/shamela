export enum Tables {
    Authors = 'authors',
    Books = 'books',
    Categories = 'categories',
    Page = 'page',
    Title = 'title',
}

export type AuthorRow = {
    biography: string;
    death: number;
    id: number;
    name: string;
};

export type BookRow = {
    author: string;
    bibliography: string;
    category: number;
    date?: null | number;
    hint: null | string;
    id: number;
    major: number;
    metadata: string;
    minor?: number;
    name: string;
    pdf_links: null | string;
    printed: number;
    type: number;
};

export type CategoryRow = {
    id: number;
    name: string;
};

export type PageRow = {
    content: string;
    id: number;
    number: null | number;
    page: null | number;
    part: null | number;
};

export type TitleRow = {
    content: string;
    id: number;
    page: number;
    parent: null | number;
};
