/**
 * @fileoverview Shamela Text Decoder
 *
 * This module provides utilities for decoding the custom Shamela encoding
 * used in their SQLite databases for Arabic text. The encoding is a substitution
 * cipher where each byte maps to an Arabic character or control function.
 *
 * @module shamela-decoder
 * @author Reverse engineered from Shamela Library database
 * @see {@link https://shamela.ws} for the original source
 */

/**
 * Categories of character mappings in the Shamela encoding.
 * Organized by verification source and function.
 */
export enum CharacterCategory {
    /** Core Arabic letters verified from multiple narrators */
    CORE_LETTERS = 'core_letters',
    /** Hamza variants (أ, إ, آ, ؤ, ئ) */
    HAMZA_VARIANTS = 'hamza_variants',
    /** Arabic diacritics (tashkeel) */
    DIACRITICS = 'diacritics',
    /** Punctuation and structural markers */
    PUNCTUATION = 'punctuation',
    /** Control bytes that should be stripped */
    CONTROL = 'control',
    /** Arabic-Indic numerals for book references */
    NUMERALS = 'numerals',
}

/**
 * Core Shamela character mapping from byte values to Arabic characters.
 *
 * This mapping was built empirically by:
 * 1. Extracting narrator names from S1.db
 * 2. Comparing encoded bytes with known correct Arabic from shamela.ws
 * 3. Identifying patterns like بن (tC) = ب ن
 * 4. Verifying each mapping against multiple narrators
 *
 * @remarks
 * - Space: 0x40 (@) maps to space
 * - Names use 0x59 for ك (kaf), while 0x6b is a structural separator
 * - Control bytes (0x7f, 0x4a, 0x4b, etc.) are stripped
 * - Numerals 0xf0-0xf9 map to digits 0-9
 */
export const SHAMELA_CHAR_MAP: Record<number, string> = {
    // === CONTROL BYTES (stripped) ===
    20: '', // Control prefix
    // === SPACE ===
    64: ' ', // @ = space (most common separator)

    // === CORE ARABIC LETTERS ===
    // Verified from: عبيد الله بن موسى بن أبي المختار (ID 4210)
    // Verified from: آدم بن أبي إياس (ID 3)
    // Verified from: أبو ماعز الأسلمي، عبد الله بن سفيان (ID 2)
    // Verified from: البخاري (ID 5495)

    67: 'ن', // C = nun (ن) - from بن = tC
    69: 'ل', // E = lam (ل) - from الله = hEEG
    70: 'م', // F = mim (م) - from آدم, موسى, المختار
    71: 'ه', // G = ha (ه) - from الله = hEEG
    74: '', // J = section start marker
    75: '', // K = diacritic suffix

    // === PUNCTUATION & STRUCTURAL ===
    77: '(', // M = opening parenthesis
    79: '"', // O = quotation mark
    85: 'ي', // U = ya (ي) - from عبيد, أبي, سفيان
    88: 'ى', // X = alif maqsura (ى) - from موسى
    89: 'ك', // Y = kaf (ك) - from حكيم, زكريا (names only)
    90: '\n', // Z = section/field end marker
    91: '[', // [ = opening bracket
    93: ')', // ] = closing parenthesis

    // === WAW VARIANTS ===
    96: 'و', // ` = waw variant (long names)

    // === NUMERALS (for book references) ===
    97: '/', // a = slash (volume/page separator)

    // === HAMZA VARIANTS ===
    98: 'آ', // b = alif with madda (آ) - from آدم
    99: 'ؤ', // c = waw with hamza (ؤ) - from الرؤاسي

    // === TA MARBUTA ===
    101: 'ة', // e = ta marbuta (variant)
    102: 'أ', // f = alif with hamza above (أ) - from أبي
    103: 'إ', // g = alif with hamza below (إ) - from إياس
    104: 'ا', // h = alif (ا) - from الله, المختار, ماعز
    105: 'ر', // i = ra (ر) - from المختار
    107: '\n', // k = separator/newline (structural, not kaf)

    // === DIACRITICS (TASHKEEL) ===
    112: 'ّ', // shadda - from القُومِسِيّ
    113: 'ة', // q = ta marbuta (primary)
    114: 'ت', // r = ta (ت) - from المختار
    115: 'ث', // s = tha (ث) - from عثمان
    116: 'ب', // t = ba (ب) - from عبيد, بن
    117: 'ح', // u = ha (ح) - from حكيم
    118: 'خ', // v = kha (خ) - from المختار, البخاري
    119: 'د', // w = dal (د) - from آدم, عبيد, عبد
    120: 'ج', // x = jim (ج) - from البجلي, الجوهري
    121: 'ث', // y = tha (variant)
    122: ':', // z = colon
    127: '', // DEL control character
    128: 'ط', // = ta - from طريف
    129: '', // control
    132: '', // control
    133: '', // control
    134: '', // control
    135: '', // control
    136: '', // control
    138: '', // control
    139: '', // control
    148: 'و', // waw variant
    149: '', // control
    153: '', // control
    155: ' ', // space variant
    156: 'و', // œ = waw (و) - from موسى
    158: 'ئ', // ya with hamza (ئ)
    162: '', // control
    164: '', // control
    166: '', // control
    168: '', // control
    170: '،', // ª = Arabic comma (،)
    171: 'و', // « = waw (conjunction in biography)
    172: 'ذ', // ¬ = dhal (ذ) - from تهذيب, ذكره
    173: 'ف', // ­ = fa (ف) - from سفيان
    174: 'ق', // ® = qaf (ق) - from قارظ
    192: '', // À = header start
    204: 'ِ', // kasra - from جمِيع, ذرِي
    205: 'ٍ', // tanween kasra - from فَصِيلٍ
    206: 'َ', // fatha - from أَو, فَصِيلٍ
    207: 'ُ', // damma - from القُومِسِي
    208: '', // Ð = control
    222: 'ْ', // sukun - from بْنِ
    224: '\n', // à = line/entry separator
    235: 'ش', // ë = shin (ش) - from شعيب
    236: 'ض', // ì = dad (ض)
    237: 'ز', // í = zay (ز) - from ماعز
    238: 'س', // î = sin (س) - from موسى, سفيان, إياس
    239: 'ص', // ï = sad (ص)
    240: '0',
    241: '1',
    242: '2',
    243: '3',
    244: '4',
    245: '5',
    246: '6',
    247: '7',
    248: '8',
    249: '9',
    251: 'غ', // û = ghain (غ) - from غفار, غيان
    252: 'ـ', // tatweel - for هـ (hijri) abbreviation
    253: 'ظ', // ý = za (ظ) - from ظبية, قارظ
    254: 'ع', // þ = ayn (ع) - from عبيد, عبد, ماعز
    255: 'غ', // ghain (variant)
};

/**
 * Extended character map for metadata decoding.
 *
 * In metadata context, 0x6b acts as a field label separator (:)
 * instead of a newline, and 0x94 should be stripped in headers.
 */
export const METADATA_CHAR_MAP: Record<number, string> = {
    ...SHAMELA_CHAR_MAP,
    107: ':', // Field separator in metadata
    148: '', // Strip in metadata headers
};

/**
 * Decodes a Shamela-encoded byte array to Arabic text.
 *
 * @param blob - The encoded byte array from the database
 * @param charMap - Character mapping to use (defaults to SHAMELA_CHAR_MAP)
 * @returns Decoded Arabic string, or empty string if blob is null
 *
 * @example
 * ```typescript
 * const encoded = new Uint8Array([0x68, 0x45, 0x45, 0x47]); // الله
 * const decoded = decodeBytes(encoded);
 * console.log(decoded); // "الله"
 * ```
 */
export const decodeBytes = (blob: Uint8Array | null, charMap: Record<number, string> = SHAMELA_CHAR_MAP) => {
    if (!blob) {
        return '';
    }

    const chars: string[] = [];
    for (const byte of blob) {
        const mapped = charMap[byte];
        if (mapped !== undefined) {
            chars.push(mapped);
        } else {
            // Keep unmapped bytes as hex placeholders for debugging
            chars.push(`[${byte.toString(16).padStart(2, '0')}]`);
        }
    }
    return chars.join('').trim();
};

/**
 * Decodes Shamela-encoded text (names, biography content).
 *
 * @param blob - The encoded byte array
 * @returns Decoded Arabic string
 */
export const decodeShamelaText = (blob: Uint8Array | null) => decodeBytes(blob, SHAMELA_CHAR_MAP);

/**
 * Decodes Shamela-encoded metadata with field label cleanup.
 *
 * Metadata has a specific structure where 0x6b acts as a field
 * separator (e.g., "الشهرة: بردان"). This function also cleans
 * up leading colons from the output.
 *
 * @param blob - The encoded metadata byte array
 * @returns Decoded and cleaned metadata string
 *
 * @example
 * ```typescript
 * // Input structure: [header bytes][field_name]0x6b[value]0x5a...
 * // Output: "الشهرة: بردان\nاللقب: بردان"
 * ```
 */
export const decodeShamelaMetadata = (blob: Uint8Array | null) => {
    if (!blob) {
        return '';
    }

    let result = decodeBytes(blob, METADATA_CHAR_MAP);

    // Clean up common metadata patterns
    // Remove leading ":" that appears from header bytes
    result = result.replace(/^:\s*/, '');
    // Remove ":" after newlines (section separators)
    result = result.replace(/\n:\s*/g, '\n');

    return result;
};

/**
 * Checks if a decoded string contains any unmapped byte placeholders.
 *
 * @param decoded - The decoded string to check
 * @returns True if the string contains [XX] hex placeholders
 */
export const hasUnmappedBytes = (decoded: string) => /\[[0-9a-f]{2}\]/i.test(decoded);

/**
 * Extracts unmapped byte placeholders from a decoded string.
 *
 * @param decoded - The decoded string to analyze
 * @returns Array of unique unmapped byte values (as hex strings)
 *
 * @example
 * ```typescript
 * const text = "Hello [ab] World [cd]";
 * const unmapped = getUnmappedBytes(text);
 * console.log(unmapped); // ["ab", "cd"]
 * ```
 */
export const getUnmappedBytes = (decoded: string) => {
    const matches = decoded.match(/\[([0-9a-f]{2})\]/gi) || [];
    const unique = new Set(matches.map((m) => m.slice(1, 3).toLowerCase()));
    return Array.from(unique);
};

/**
 * Counts occurrences of each unmapped byte in a decoded string.
 *
 * @param decoded - The decoded string to analyze
 * @returns Map of byte hex value to occurrence count
 */
export const countUnmappedBytes = (decoded: string) => {
    const counts = new Map<string, number>();
    const regex = /\[([0-9a-f]{2})\]/gi;
    let match;

    while ((match = regex.exec(decoded)) !== null) {
        const byte = match[1].toLowerCase();
        counts.set(byte, (counts.get(byte) || 0) + 1);
    }

    return counts;
};
