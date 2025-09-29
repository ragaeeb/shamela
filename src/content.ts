import { DEFAULT_SANITIZATION_RULES } from './utils/constants';

export type Line = {
    id?: string;
    text: string;
};

const PUNCT_ONLY = /^[)\]\u00BB"”'’.,?!:\u061B\u060C\u061F\u06D4\u2026]+$/;
const OPENER_AT_END = /[[({«“‘]$/;

const mergeDanglingPunctuation = (lines: Line[]): Line[] => {
    const out: Line[] = [];
    for (const item of lines) {
        const last = out[out.length - 1];
        if (last?.id && PUNCT_ONLY.test(item.text)) {
            last.text += item.text;
        } else {
            out.push(item);
        }
    }
    return out;
};

const splitIntoLines = (text: string) => {
    let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (!/\n/.test(normalized)) {
        normalized = normalized.replace(/([.?!\u061F\u061B\u06D4\u2026]["“”'’»«)\]]?)\s+(?=[\u0600-\u06FF])/, '$1\n');
    }

    return normalized
        .split('\n')
        .map((line) => line.replace(/^\*+/, '').trim())
        .filter(Boolean);
};

const processTextContent = (content: string): Line[] => {
    return splitIntoLines(content).map((line) => ({ text: line }));
};

const extractAttribute = (tag: string, name: string): string | undefined => {
    const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^s>]+))`, 'i');
    const match = tag.match(pattern);
    if (!match) {
        return undefined;
    }
    return match[2] ?? match[3] ?? match[4];
};

type Token =
    | { type: 'text'; value: string }
    | { type: 'start'; name: string; attributes: Record<string, string | undefined> }
    | { type: 'end'; name: string };

const tokenize = (html: string): Token[] => {
    const tokens: Token[] = [];
    const tagRegex = /<[^>]+>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    match = tagRegex.exec(html);

    while (match) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: html.slice(lastIndex, match.index) });
        }

        const raw = match[0];
        const isEnd = /^<\//.test(raw);
        const nameMatch = raw.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : '';

        if (isEnd) {
            tokens.push({ name, type: 'end' });
        } else {
            const attributes: Record<string, string | undefined> = {};
            attributes.id = extractAttribute(raw, 'id');
            attributes['data-type'] = extractAttribute(raw, 'data-type');
            tokens.push({ attributes, name, type: 'start' });
        }

        lastIndex = tagRegex.lastIndex;
        match = tagRegex.exec(html);
    }

    if (lastIndex < html.length) {
        tokens.push({ type: 'text', value: html.slice(lastIndex) });
    }

    return tokens;
};

const maybeAppendToPrevTitle = (result: Line[], raw: string) => {
    const last = result[result.length - 1];
    if (!raw) {
        return false;
    }
    if (!last || !last.id) {
        return false;
    }
    if (!OPENER_AT_END.test(last.text)) {
        return false;
    }
    if (/\n/.test(raw)) {
        return false;
    }
    last.text += raw.replace(/^\s+/, '');
    return true;
};

export const parseContentRobust = (content: string): Line[] => {
    if (!/<span[^>]*>/i.test(content)) {
        return processTextContent(content);
    }

    const tokens = tokenize(`<root>${content}</root>`);
    const result: Line[] = [];

    let titleDepth = 0;
    let currentTitle: Line | null = null;

    const pushText = (raw: string) => {
        if (!raw) {
            return;
        }

        if (titleDepth > 0 && currentTitle) {
            const cleaned = titleDepth === 1 ? raw.replace(/^\s+/, '') : raw;
            currentTitle.text += cleaned;
            return;
        }

        if (maybeAppendToPrevTitle(result, raw)) {
            return;
        }

        const text = raw.trim();
        if (text) {
            result.push(...processTextContent(text));
        }
    };

    for (const token of tokens) {
        if (token.type === 'text') {
            pushText(token.value);
        } else if (token.type === 'start' && token.name === 'span') {
            const dataType = token.attributes['data-type'];
            if (dataType === 'title') {
                if (titleDepth === 0) {
                    const id = token.attributes.id?.replace(/^toc-/, '') ?? '';
                    currentTitle = { id, text: '' };
                    result.push(currentTitle);
                }
                titleDepth += 1;
            }
        } else if (token.type === 'end' && token.name === 'span') {
            if (titleDepth > 0) {
                titleDepth -= 1;
                if (titleDepth === 0) {
                    currentTitle = null;
                }
            }
        }
    }

    const cleaned = result.map((line) => (line.id ? line : { ...line, text: line.text.trim() }));

    return mergeDanglingPunctuation(cleaned.map((line) => (line.id ? line : { ...line, text: line.text }))).filter(
        (line) => line.text.length > 0,
    );
};

const DEFAULT_COMPILED_RULES = Object.entries(DEFAULT_SANITIZATION_RULES).map(([pattern, replacement]) => ({
    regex: new RegExp(pattern, 'g'),
    replacement,
}));

/**
 * Compiles sanitization rules into RegExp objects for performance
 */
const getCompiledRules = (rules: Record<string, string>) => {
    if (rules === DEFAULT_SANITIZATION_RULES) {
        return DEFAULT_COMPILED_RULES;
    }

    const compiled = [];
    for (const pattern in rules) {
        compiled.push({
            regex: new RegExp(pattern, 'g'),
            replacement: rules[pattern],
        });
    }
    return compiled;
};

/**
 * Sanitizes page content by applying regex replacement rules
 * @param text - The text to sanitize
 * @param rules - Optional custom rules (defaults to DEFAULT_SANITIZATION_RULES)
 * @returns The sanitized text
 */
export const sanitizePageContent = (
    text: string,
    rules: Record<string, string> = DEFAULT_SANITIZATION_RULES,
): string => {
    const compiledRules = getCompiledRules(rules);

    let content = text;
    for (let i = 0; i < compiledRules.length; i++) {
        const { regex, replacement } = compiledRules[i];
        content = content.replace(regex, replacement);
    }
    return content;
};

export const splitPageBodyFromFooter = (content: string, footnoteMarker = '_________') => {
    let footnote = '';
    const indexOfFootnote = content.lastIndexOf(footnoteMarker);

    if (indexOfFootnote >= 0) {
        footnote = content.slice(indexOfFootnote + footnoteMarker.length);
        content = content.slice(0, indexOfFootnote);
    }

    return [content, footnote] as const;
};

export const removeArabicNumericPageMarkers = (text: string) => {
    return text.replace(/\s?⦗[\u0660-\u0669]+⦘\s?/, ' ');
};

export const removeTagsExceptSpan = (content: string) => {
    // Remove <a> tags and their content, keeping only the text inside
    content = content.replace(/<a[^>]*>(.*?)<\/a>/g, '$1');

    // Remove <hadeeth> tags (both self-closing, with content, and numbered)
    content = content.replace(/<hadeeth[^>]*>|<\/hadeeth>|<hadeeth-\d+>/g, '');

    return content;
};
