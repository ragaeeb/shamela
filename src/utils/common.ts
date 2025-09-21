import type { PageRow, TitleRow } from '@/db/types';

/**
 * Redacts sensitive query parameters from a URL for safe logging
 * @param url - The URL to redact
 * @param sensitiveParams - Array of parameter names to redact (defaults to common sensitive params)
 * @returns The URL string with sensitive parameters redacted
 */
export const redactUrl = (
    url: URL | string,
    sensitiveParams: string[] = ['api_key', 'token', 'password', 'secret', 'auth'],
): string => {
    const urlObj = typeof url === 'string' ? new URL(url) : new URL(url.toString());

    sensitiveParams.forEach((param) => {
        const value = urlObj.searchParams.get(param);
        if (value && value.length > 6) {
            const redacted = `${value.slice(0, 3)}***${value.slice(-3)}`;
            urlObj.searchParams.set(param, redacted);
        } else if (value) {
            urlObj.searchParams.set(param, '***');
        }
    });

    return urlObj.toString();
};

export const mapPageRowToPage = (page: PageRow) => {
    return {
        content: page.content,
        id: page.id,
        ...(page.number && { number: page.number }),
        ...(page.page && { page: Number(page.page) }),
        ...(page.part && { part: page.part }),
    };
};

export const mapTitleRowToTitle = (title: TitleRow) => {
    const parent = Number(title.parent);

    return {
        content: title.content,
        id: title.id,
        page: Number(title.page),
        ...(parent && { parent }),
    };
};
