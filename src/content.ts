import { DEFAULT_MAPPING_RULES } from './utils/constants';

export type Line = {
    id?: string;
    text: string;
};

const PUNCT_ONLY = /^[)\]\u00BB"”'’.,?!:\u061B\u060C\u061F\u06D4\u2026]+$/;

/**
 * Merges punctuation-only lines into the preceding title when appropriate.
 *
 * @param lines - The processed line candidates to normalise
 * @returns A new array where dangling punctuation fragments are appended to titles
 */
const mergeDanglingPunctuation = (lines: Line[]): Line[] => {
    const out: Line[] = [];
    for (const item of lines) {
        const last = out[out.length - 1];
        if (last && PUNCT_ONLY.test(item.text)) {
            last.text += item.text;
        } else {
            out.push(item);
        }
    }
    return out;
};

/**
 * Normalises raw text into discrete line entries.
 *
 * @param text - Raw book content potentially containing inconsistent breaks
 * @returns An array of trimmed line strings with empty entries removed
 */
const splitIntoLines = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
};

/**
 * Converts plain text content into {@link Line} objects without title metadata.
 *
 * @param content - The text content to split into line structures
 * @returns A {@link Line} array wrapping each detected sentence fragment
 */
const processTextContent = (content: string): Line[] => {
    return splitIntoLines(content).map((line) => ({ text: line }));
};

/**
 * Extracts an attribute value from the provided HTML tag string.
 *
 * @param tag - Raw HTML tag source
 * @param name - Attribute name to locate
 * @returns The attribute value when found; otherwise undefined
 */
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

/**
 * Breaks the provided HTML fragment into structural tokens.
 *
 * @param html - HTML fragment containing book content markup
 * @returns A token stream describing text and span boundaries
 */
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

/**
 * Pushes the accumulated text as a new line to the result array.
 */
const createLine = (text: string, id?: string): Line | null => {
    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }
    return id ? { id, text: trimmed } : { text: trimmed };
};

/**
 * Finds the active title ID from the span stack.
 */
const getActiveTitleId = (spanStack: Array<{ isTitle: boolean; id?: string }>): string | undefined => {
    for (let i = spanStack.length - 1; i >= 0; i--) {
        const entry = spanStack[i];
        if (entry.isTitle && entry.id) {
            return entry.id;
        }
    }
};

/**
 * Processes text content by handling line breaks and maintaining title context.
 */
const processTextWithLineBreaks = (
    raw: string,
    state: {
        currentText: string;
        currentId?: string;
        result: Line[];
        spanStack: Array<{ isTitle: boolean; id?: string }>;
    },
) => {
    if (!raw) {
        return;
    }

    const parts = raw.split('\n');

    for (let i = 0; i < parts.length; i++) {
        // Push previous line when crossing a line break
        if (i > 0) {
            const line = createLine(state.currentText, state.currentId);
            if (line) {
                state.result.push(line);
            }
            state.currentText = '';

            // Preserve title ID if still inside a title span
            const activeTitleId = getActiveTitleId(state.spanStack);
            state.currentId = activeTitleId || undefined;
        }

        // Append the text part
        if (parts[i]) {
            state.currentText += parts[i];
        }
    }
};

/**
 * Handles the start of a span tag, updating the stack and current ID.
 */
const handleSpanStart = (
    token: { attributes: Record<string, string | undefined> },
    state: {
        currentId?: string;
        spanStack: Array<{ isTitle: boolean; id?: string }>;
    },
) => {
    const dataType = token.attributes['data-type'];
    const isTitle = dataType === 'title';

    let id: string | undefined;
    if (isTitle) {
        const rawId = token.attributes.id ?? '';
        id = rawId.replace(/^toc-/, '');
    }

    state.spanStack.push({ id, isTitle });

    // First title span on the current physical line wins
    if (isTitle && id && !state.currentId) {
        state.currentId = id;
    }
};

/**
 * Parses Shamela HTML content into structured lines while preserving headings.
 *
 * @param content - The raw HTML markup representing a page
 * @returns An array of {@link Line} objects containing text and optional IDs
 */
export const parseContentRobust = (content: string): Line[] => {
    // Normalize line endings first
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Fast path when there are no span tags at all
    if (!/<span[^>]*>/i.test(content)) {
        return mergeDanglingPunctuation(processTextContent(content));
    }

    const tokens = tokenize(`<root>${content}</root>`);
    const state = {
        currentId: undefined as string | undefined,
        currentText: '',
        result: [] as Line[],
        spanStack: [] as Array<{ isTitle: boolean; id?: string }>,
    };

    // Process all tokens
    for (const token of tokens) {
        if (token.type === 'text') {
            processTextWithLineBreaks(token.value, state);
        } else if (token.type === 'start' && token.name === 'span') {
            handleSpanStart(token, state);
        } else if (token.type === 'end' && token.name === 'span') {
            // Closing a span does NOT end the line; trailing text stays on the same line
            state.spanStack.pop();
        }
    }

    // Flush any trailing text
    const finalLine = createLine(state.currentText, state.currentId);
    if (finalLine) {
        state.result.push(finalLine);
    }

    // Merge punctuation-only lines and drop empties
    return mergeDanglingPunctuation(state.result).filter((line) => line.text.length > 0);
};

const DEFAULT_COMPILED_RULES = Object.entries(DEFAULT_MAPPING_RULES).map(([pattern, replacement]) => ({
    regex: new RegExp(pattern, 'g'),
    replacement,
}));

/**
 * Compiles sanitisation rules into RegExp objects for reuse.
 *
 * @param rules - Key/value replacements used during sanitisation
 * @returns A list of compiled regular expression rules
 */
const getCompiledRules = (rules: Record<string, string>) => {
    if (rules === DEFAULT_MAPPING_RULES) {
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
 * Sanitises page content by applying regex replacement rules.
 *
 * @param text - The text to clean
 * @param rules - Optional custom replacements, defaults to {@link DEFAULT_MAPPING_RULES}
 * @returns The sanitised content
 */
export const mapPageCharacterContent = (
    text: string,
    rules: Record<string, string> = DEFAULT_MAPPING_RULES,
): string => {
    const compiledRules = getCompiledRules(rules);

    let content = text;
    for (let i = 0; i < compiledRules.length; i++) {
        const { regex, replacement } = compiledRules[i];
        content = content.replace(regex, replacement);
    }
    return content;
};

/**
 * Splits a page body from its trailing footnotes using a marker string.
 *
 * @param content - Combined body and footnote text
 * @param footnoteMarker - Marker indicating the start of footnotes
 * @returns A tuple containing the page body followed by the footnote section
 */
export const splitPageBodyFromFooter = (content: string, footnoteMarker = '_________') => {
    let footnote = '';
    const indexOfFootnote = content.indexOf(footnoteMarker);

    if (indexOfFootnote >= 0) {
        footnote = content.slice(indexOfFootnote + footnoteMarker.length);
        content = content.slice(0, indexOfFootnote);
    }

    return [content, footnote] as const;
};

/**
 * Removes Arabic numeral page markers enclosed in turtle ⦗ ⦘ brackets.
 * Replaces the marker along with up to two preceding whitespace characters
 * (space or carriage return) and up to one following whitespace character
 * with a single space.
 *
 * @param text - Text potentially containing page markers
 * @returns The text with numeric markers replaced by a single space
 */
export const removeArabicNumericPageMarkers = (text: string) => {
    return text.replace(/(?: |\r){0,2}⦗[\u0660-\u0669]+⦘(?: |\r)?/g, ' ');
};

/**
 * Removes anchor and hadeeth tags from the content while preserving spans.
 *
 * @param content - HTML string containing various tags
 * @returns The content with only span tags retained
 */
export const removeTagsExceptSpan = (content: string) => {
    // Remove <a> tags and their content, keeping only the text inside
    content = content.replace(/<a[^>]*>(.*?)<\/a>/gs, '$1');

    // Remove <hadeeth> tags (both self-closing, with content, and numbered)
    content = content.replace(/<hadeeth[^>]*>|<\/hadeeth>|<hadeeth-\d+>/gs, '');

    return content;
};

/**
 * Normalizes Shamela HTML for CSS styling:
 * - Converts <hadeeth-N> to <span class="hadeeth">
 * - Converts </hadeeth> or standalone <hadeeth> to </span>
 */
export const normalizeHtml = (html: string): string => {
    return html.replace(/<hadeeth-\d+>/gi, '<span class="hadeeth">').replace(/<\s*\/?\s*hadeeth\s*>/gi, '</span>');
};

/**
 * Convert Shamela HTML to Markdown format for easier pattern matching.
 *
 * Transformations:
 * - `<span data-type="title">text</span>` → `## text`
 * - `<a href="inr://...">text</a>` → `text` (strip narrator links)
 * - All other HTML tags → stripped
 *
 * Note: Content typically already has proper line breaks before title spans,
 * so we don't add extra newlines around the ## header.
 * Line ending normalization is handled by segmentPages.
 *
 * @param html - HTML content from Shamela
 * @returns Markdown-formatted content
 */
export const htmlToMarkdown = (html: string): string => {
    return (
        html
            // Convert title spans to markdown headers (no extra newlines - content already has them)
            .replace(/<span[^>]*data-type=["']title["'][^>]*>(.*?)<\/span>/gi, '## $1')
            // Strip narrator links but keep text
            .replace(/<a[^>]*href=["']inr:\/\/[^"']*["'][^>]*>(.*?)<\/a>/gi, '$1')
            // Strip all remaining HTML tags
            .replace(/<[^>]*>/g, '')
    );
};
