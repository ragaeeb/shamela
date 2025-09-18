export type Line = {
    id?: string;
    text: string;
};

const PUNCT_ONLY = /^[)\]\u00BB"”'’.,?!:\u061B\u060C\u061F\u06D4\u2026]+$/;
const OPENER_AT_END = /[[({«“‘]$/;
const FOOTNOTE_MARKER = '_________';

const mergeDanglingPunctuation = (lines: Line[]): Line[] => {
    const out: Line[] = [];
    for (const item of lines) {
        const last = out[out.length - 1];
        if (last && last.id && PUNCT_ONLY.test(item.text)) {
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
        normalized = normalized.replace(
            /([.?!\u061F\u061B\u06D4\u2026]["“”'’»«)\]]?)\s+(?=[\u0600-\u06FF])/,
            '$1\n',
        );
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
    const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\s>]+))`, 'i');
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

    while ((match = tagRegex.exec(html))) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: html.slice(lastIndex, match.index) });
        }

        const raw = match[0];
        const isEnd = /^<\//.test(raw);
        const nameMatch = raw.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : '';

        if (isEnd) {
            tokens.push({ type: 'end', name });
        } else {
            const attributes: Record<string, string | undefined> = {};
            attributes['id'] = extractAttribute(raw, 'id');
            attributes['data-type'] = extractAttribute(raw, 'data-type');
            tokens.push({ type: 'start', name, attributes });
        }

        lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < html.length) {
        tokens.push({ type: 'text', value: html.slice(lastIndex) });
    }

    return tokens;
};

const removeFootnoteReferencesSimpleInternal = (value: string) =>
    value
        .replace(/<sup[^>]*>[^<]*<\/sup>/gi, '')
        .replace(/(?:\(|\[)\s*[0-9\u0660-\u0669]+\s*(?:\)|\])/g, '');

const removeSingleDigitFootnoteReferencesInternal = (value: string) =>
    value.replace(/(?<=\s)[0-9\u0660-\u0669](?=\s)/g, '');

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
                    const id = token.attributes['id']?.replace(/^toc-/, '') ?? '';
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

export const removeFootnoteReferencesSimple = (value: string) => {
    return removeFootnoteReferencesSimpleInternal(value);
};

export const removeSingleDigitFootnoteReferences = (value: string) => {
    return removeSingleDigitFootnoteReferencesInternal(value);
};

export const sanitizePageContent = (text: string) => {
    let content = text
        .replace(/舄/g, '')
        .replace(/<img[^>]*>>/g, '')
        .replace(/﵌/g, 'صلى الله عليه وآله وسلم');
    let footnote = '';
    const indexOfFootnote = content.lastIndexOf(FOOTNOTE_MARKER);

    if (indexOfFootnote >= 0) {
        footnote = content.slice(indexOfFootnote + FOOTNOTE_MARKER.length);
        content = content.slice(0, indexOfFootnote);
    }

    content = removeSingleDigitFootnoteReferences(content);
    content = removeFootnoteReferencesSimple(content);

    return [content, footnote] as const;
};
