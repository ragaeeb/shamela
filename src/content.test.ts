import { describe, expect, it } from 'bun:test';

import {
    convertContentToMarkdown,
    htmlToMarkdown,
    mapPageCharacterContent,
    moveContentAfterLineBreakIntoSpan,
    normalizeHtml,
    normalizeLineEndings,
    normalizeTitleSpans,
    parseContentRobust,
    removeArabicNumericPageMarkers,
    removeTagsExceptSpan,
    splitPageBodyFromFooter,
    stripHtmlTags,
} from './content';
import { DEFAULT_MAPPING_RULES } from './utils/constants';

describe('content', () => {
    describe('mapPageCharacterContent', () => {
        it('should remove 舄 character', () => {
            const input = 'Hello 舄 world 舄 test';
            const expected = 'Hello  world  test';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should remove malformed img tags', () => {
            const input = "Text <img src='test'>> more text <img alt='test'>>";
            const expected = 'Text  more text ';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should replace ﵌ with Arabic blessing', () => {
            const input = 'Prophet Muhammad ﵌ was born';
            const expected = 'Prophet Muhammad صلى الله عليه وآله وسلم was born';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should apply all default rules in combination', () => {
            const input = "Test 舄 content <img src='test'>> with ﵌ multiple rules";
            const expected = 'Test  content  with صلى الله عليه وآله وسلم multiple rules';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should handle multiple occurrences of same pattern', () => {
            const input = '舄舄舄 multiple 舄 occurrences 舄';
            const expected = ' multiple  occurrences ';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(mapPageCharacterContent('')).toBe('');
        });

        it('should handle text with no matches', () => {
            const input = 'Normal text with no special characters';
            expect(mapPageCharacterContent(input)).toBe(input);
        });

        it('should handle text with only whitespace', () => {
            const input = '   \n\t  ';
            expect(mapPageCharacterContent(input)).toBe(input);
        });
    });

    describe('custom rules behavior', () => {
        it('should apply custom rules only', () => {
            const customRules = {
                '\\d+': '[NUMBER]',
                foo: 'bar',
            };
            const input = 'foo test 123 舄'; // 舄 should remain since not in custom rules
            const expected = 'bar test [NUMBER] 舄';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });

        it('should override default rules with custom ones', () => {
            const customRules = {
                ...DEFAULT_MAPPING_RULES,
                舄: '[REMOVED]', // Override default removal with replacement
            };
            const input = 'Test 舄 override';
            const expected = 'Test [REMOVED] override';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });

        it('should extend default rules with additional ones', () => {
            const customRules = {
                ...DEFAULT_MAPPING_RULES,
                extra: 'EXTRA',
            };
            const input = 'Test 舄 extra ﵌ content';
            const expected = 'Test  EXTRA صلى الله عليه وآله وسلم content';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });

        it('should handle empty custom rules object', () => {
            const input = 'Test 舄 content ﵌';
            expect(mapPageCharacterContent(input, {})).toBe(input); // No rules applied
        });

        it('should handle complex regex patterns in custom rules', () => {
            const customRules = {
                '[0-9]+': 'X', // Replace numbers
                '\\b\\w{4}\\b': '[FOUR]', // Replace 4-letter words
            };
            const input = 'This test has 123 and some text';
            const expected = '[FOUR] [FOUR] has X and [FOUR] [FOUR]';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });

        it('should handle special regex characters in patterns', () => {
            const customRules = {
                '\\[.*?\\]': '(brackets)', // Replace content in brackets
                '\\$\\d+': '[PRICE]', // Match $123 format
            };
            const input = 'Price $50 and [some text] here';
            const expected = 'Price [PRICE] and (brackets) here';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });

        it('should handle rules with empty replacement strings', () => {
            const customRules = {
                remove: '',
                replace: 'REPLACED',
            };
            const input = 'remove this and replace that';
            const expected = ' this and REPLACED that';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });
    });

    describe('performance and edge cases', () => {
        it('should handle very long strings', () => {
            const input = `${'a'.repeat(10000)}舄${'b'.repeat(10000)}`;
            const expected = `${'a'.repeat(10000)}${'b'.repeat(10000)}`;
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should handle unicode characters correctly', () => {
            const input = 'Test 舄 emoji 😀 and ﵌ unicode';
            const expected = 'Test  emoji 😀 and صلى الله عليه وآله وسلم unicode';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should handle newlines and special whitespace', () => {
            const input = 'Line1\n舄\nLine2\t﵌\rLine3';
            const expected = 'Line1\n\nLine2\tصلى الله عليه وآله وسلم\rLine3';
            expect(mapPageCharacterContent(input)).toBe(expected);
        });

        it('should maintain object reference equality for default rules', () => {
            // This tests the performance optimization path
            const input = 'test 舄 content';
            const result1 = mapPageCharacterContent(input);
            const result2 = mapPageCharacterContent(input, DEFAULT_MAPPING_RULES);
            expect(result1).toBe(result2);
            expect(result1).toBe('test  content');
        });

        it("should handle rules that don't match anything", () => {
            const customRules = {
                another: 'value',
                nonexistent: 'replacement',
            };
            const input = 'This text has no matches';
            expect(mapPageCharacterContent(input, customRules)).toBe(input);
        });

        it('should handle overlapping patterns correctly', () => {
            const customRules = {
                ab: 'X',
                abc: 'Y',
            };
            const input = 'abc def';
            // Since 'ab' is processed first (object iteration order), 'abc' becomes 'Xc'
            // Then 'abc' pattern won't match 'Xc', so result is 'Xc def'
            const result = mapPageCharacterContent(input, customRules);
            expect(result).toMatch(/^[XY]c? def$/); // Either 'Xc def' or 'Y def' depending on iteration order
        });
    });

    describe('rule compilation edge cases', () => {
        it('should handle invalid regex patterns gracefully', () => {
            const customRules = {
                '[': 'replacement', // Invalid regex - unclosed bracket
            };
            const input = 'test [ content';

            // This should throw when creating RegExp, testing error handling
            expect(() => mapPageCharacterContent(input, customRules)).toThrow();
        });

        it('should handle rules with literal string patterns', () => {
            const customRules = {
                'hello world': 'hi earth',
            };
            const input = 'Say hello world to everyone';
            const expected = 'Say hi earth to everyone';
            expect(mapPageCharacterContent(input, customRules)).toBe(expected);
        });
    });

    describe('parseContentRobust', () => {
        it('should handle nested tags', () => {
            const actual = parseContentRobust(
                `من الثامنة ت\r\r<span data-type="title" id=toc-66><span data-type="title" id=toc-67>ذكر من اسمه فضيل بالتصغير إلى آخر حرف الفاء</span></span>\r٥٤٢٦- فضيل ابن حسين`,
            );

            expect(actual).toEqual([
                {
                    text: 'من الثامنة ت',
                },
                {
                    id: '66',
                    text: 'ذكر من اسمه فضيل بالتصغير إلى آخر حرف الفاء',
                },
                {
                    text: '٥٤٢٦- فضيل ابن حسين',
                },
            ]);
        });

        it('should combine nested tags into one', () => {
            const actual = parseContentRobust(
                `<span data-type="title" id=toc-137><span data-type="title" id=toc-139>ب</span><span data-type="title" id=toc-138>ا</span>ب الأنساب إلى القبائل والبلاد والصنائع وغير ذلك</span>\r[أ]`,
            );

            expect(actual).toEqual([
                {
                    id: '137',
                    text: 'باب الأنساب إلى القبائل والبلاد والصنائع وغير ذلك',
                },
                {
                    text: '[أ]',
                },
            ]);
        });

        it('should not add a line break', () => {
            const actual = parseContentRobust(
                `<span data-type="title" id=toc-179>فِي تَفْسِيرِ قَوْلِهِ عَزَّ وَجَلَّ: {وَلَدَيْنَا مَزِيدٌ} [</span>ق: ٣٥]`,
            );

            expect(actual).toEqual([
                {
                    id: '179',
                    text: `فِي تَفْسِيرِ قَوْلِهِ عَزَّ وَجَلَّ: {وَلَدَيْنَا مَزِيدٌ} [ق: ٣٥]`,
                },
            ]);
        });

        it('should merge the quote', () => {
            const actual = parseContentRobust(
                `<span data-type='title' id=toc-5004>سَلْمَى بِنْتُ عُمَيْسِ بْنِ مَعْبَدٍ الْخَثْعَمِيَّةُ أُخْتُ أَسْمَاءَ </span>"`,
            );

            expect(actual).toEqual([
                {
                    id: '5004',
                    text: 'سَلْمَى بِنْتُ عُمَيْسِ بْنِ مَعْبَدٍ الْخَثْعَمِيَّةُ أُخْتُ أَسْمَاءَ "',
                },
            ]);
        });

        it('should merge the period', () => {
            const actual = parseContentRobust(
                `\r<span data-type="title" id=toc-5>٤ - أبان بن حاتم الأملوكي من مشيخة أبي التقى اليزي</span>.\rروى عن عمر ابن المغيرة مجهول`,
            );

            expect(actual).toEqual([
                {
                    id: '5',
                    text: '٤ - أبان بن حاتم الأملوكي من مشيخة أبي التقى اليزي.',
                },
                {
                    text: 'روى عن عمر ابن المغيرة مجهول',
                },
            ]);
        });

        it('should keep the dash on the same line', () => {
            const input =
                "<span data-type='title' id=toc-285>٢٥ - [بَابُ] (¬٥) الصَّلَاةِ عَلَى النَّبِيِّ ﷺ </span>-\r٩٠٣ - (صحيح) حَدَّثَنَاةُ";

            const actual = parseContentRobust(input);

            expect(actual).toEqual([
                {
                    id: '285',
                    text: '٢٥ - [بَابُ] (¬٥) الصَّلَاةِ عَلَى النَّبِيِّ ﷺ -',
                },
                {
                    text: '٩٠٣ - (صحيح) حَدَّثَنَاةُ',
                },
            ]);
        });

        it('should keep the dash and bracket on the same line', () => {
            const input =
                "<span data-type='title' id=toc-47>[فَضْلُ عَبْدِ اللهِ بْنِ مَسْعُودٍ ﵁ </span>-] (¬١)\r١٣٧ - (ضعيف) حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ، حَدَّثَنَا وَكِيعٌ، حَدَّثَنَا [م: ٢١٦٩، تحفة: ٩٣٨٨]\r\r<span data-type='title' id=toc-48>فَضَائِلُ الْعَبَّاسِ بْنِ عَبْدِ الْمُطَّلِبِ [﵁ </span>-] (¬١)\r١٤٠ - (ضعيف) حَدَّثَنَا مُحَمَّدُ بْنُ طَرِيفٍ، حَدَّثَنَا  [يَوْمَ الْقِيَامَةِ] (¬١) تُجَاهَيْنِ، وَالْعَبَّاسُ بَيْنَنَا؛ مُؤْمِنٌ بَيْنَ خَلِيلَيْنِ\". [الضعيفة: ٣٠٣٤، تحفة: ٨٩١٤]\r\r<span data-type='title' id=toc-49>فَضَائِلُ (¬٥) الْحَسَنِ وَالْحُسَيْنِ ابْنَيْ عَلِيِّ بْنِ أَبِي طَالِبٍ ﵃ </span>-\r١٤٢ - (صحيح) حَدَّثَنَا أَحْمَدُ بْنُ عَبْدَةَ، أَخْبَرَنَا سُفْيَانُ بْنُ عُيَيْنَةَ، عَنْ عُبَيْدِ اللهِ : ١٤٦٣٤]";
            const actual = parseContentRobust(input);

            expect(actual).toEqual([
                {
                    id: '47',
                    text: '[فَضْلُ عَبْدِ اللهِ بْنِ مَسْعُودٍ ﵁ -] (¬١)',
                },
                {
                    text: '١٣٧ - (ضعيف) حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ، حَدَّثَنَا وَكِيعٌ، حَدَّثَنَا [م: ٢١٦٩، تحفة: ٩٣٨٨]',
                },
                {
                    id: '48',
                    text: 'فَضَائِلُ الْعَبَّاسِ بْنِ عَبْدِ الْمُطَّلِبِ [﵁ -] (¬١)',
                },
                {
                    text: '١٤٠ - (ضعيف) حَدَّثَنَا مُحَمَّدُ بْنُ طَرِيفٍ، حَدَّثَنَا  [يَوْمَ الْقِيَامَةِ] (¬١) تُجَاهَيْنِ، وَالْعَبَّاسُ بَيْنَنَا؛ مُؤْمِنٌ بَيْنَ خَلِيلَيْنِ". [الضعيفة: ٣٠٣٤، تحفة: ٨٩١٤]',
                },
                {
                    id: '49',
                    text: 'فَضَائِلُ (¬٥) الْحَسَنِ وَالْحُسَيْنِ ابْنَيْ عَلِيِّ بْنِ أَبِي طَالِبٍ ﵃ -',
                },
                {
                    text: '١٤٢ - (صحيح) حَدَّثَنَا أَحْمَدُ بْنُ عَبْدَةَ، أَخْبَرَنَا سُفْيَانُ بْنُ عُيَيْنَةَ، عَنْ عُبَيْدِ اللهِ : ١٤٦٣٤]',
                },
            ]);
        });
    });

    describe('splitPageBodyFromFooter', () => {
        it('splitPageBodyFromFooter separates trailing footnotes', () => {
            const [body, footer] = splitPageBodyFromFooter('content_________footnote');
            expect(body).toBe('content');
            expect(footer).toBe('footnote');
        });

        it('splitPageBodyFromFooter returns original text when marker missing', () => {
            const [body, footer] = splitPageBodyFromFooter('content only');
            expect(body).toBe('content only');
            expect(footer).toBe('');
        });

        it('should handle the double footer', () => {
            // example: shamela/book/25794/5117
            const input = 'A\r_________\rB\r_________\rC';

            const [body, footer] = splitPageBodyFromFooter(input);

            expect(body).toBe('A\r');
            expect(footer).toBe('\rB\r_________\rC');
        });
    });

    describe('removeArabicNumericPageMarkers', () => {
        it('removeArabicNumericPageMarkers strips numeric markers', () => {
            expect(removeArabicNumericPageMarkers('النص ⦗١٢٣⦘ هنا')).toBe('النص هنا');
        });

        it('removeArabicNumericPageMarkers handles empty string', () => {
            expect(removeArabicNumericPageMarkers('')).toBe('');
        });

        it('removeArabicNumericPageMarkers handles text without markers', () => {
            const input = 'نص بدون علامات';
            expect(removeArabicNumericPageMarkers(input)).toBe(input);
        });

        it('should merge line breaks', () => {
            const input = `بِمُوسَى\r⦗١٨٤⦘\rمِنْ`;
            const actual = removeArabicNumericPageMarkers(input);

            expect(actual).toBe('بِمُوسَى مِنْ');
        });

        it('should handle the double carriage returns before', () => {
            const input = `أَبِي\r\r⦗٦٣⦘\rحَازِمٍ،`;
            const actual = removeArabicNumericPageMarkers(input);

            expect(actual).toBe('أَبِي حَازِمٍ،');
        });

        it('should remove the page marker before the period', () => {
            const input = 'وَاسْتَسْلَمَ " ⦗١١⦘. خَالَفَهُ';
            const actual = removeArabicNumericPageMarkers(input);

            expect(actual).toBe('وَاسْتَسْلَمَ " . خَالَفَهُ');
        });

        it('should keep a single carriage return since it should only take out at most a single carriage return after the markers', () => {
            const input = 'رَأْسُهُ وَيُسَمَّى»\r⦗٣٧٣⦘\r\r٤٥٣٣ - أَخْبَرَنَا هَارُونُ';
            const actual = removeArabicNumericPageMarkers(input);

            expect(actual).toBe('رَأْسُهُ وَيُسَمَّى» \r٤٥٣٣ - أَخْبَرَنَا هَارُونُ');
        });
    });

    describe('removeTagsExceptSpan', () => {
        it('should remove anchor and hadeeth tags while keeping text', () => {
            const input = "قبل <a href='#'>رابط</a> <hadeeth>نص</hadeeth> <span>يبقى</span>";
            expect(removeTagsExceptSpan(input)).toBe('قبل رابط نص <span>يبقى</span>');
        });

        it('removeTagsExceptSpan handles empty string', () => {
            expect(removeTagsExceptSpan('')).toBe('');
        });

        it('removeTagsExceptSpan preserves multiple span tags', () => {
            const input = '<span>أول</span> نص <span>ثاني</span>';
            expect(removeTagsExceptSpan(input)).toBe(input);
        });

        it('removeTagsExceptSpan handles text without tags', () => {
            const input = 'نص بدون وسوم';
            expect(removeTagsExceptSpan(input)).toBe(input);
        });

        it('should handle nested tags', () => {
            const input = '<a href="#">خارج <span>داخل</span></a>';
            expect(removeTagsExceptSpan(input)).toBe('خارج <span>داخل</span>');
        });

        it('should handle links when split over multiple lines', () => {
            const input =
                'A <a href="inr://man-5898">B</a>. C<a href="inr://man-3414">D\r⦗٩⦘ E</a> F <hadeeth-29254>G<hadeeth>';
            const actual = removeTagsExceptSpan(input);
            expect(actual).toEqual(`A B. CD\r⦗٩⦘ E F G`);
        });
    });

    describe('htmlToMarkdown', () => {
        it('should convert title spans with double quotes to markdown headers', () => {
            const input = '<span data-type="title">Chapter One</span>';
            expect(htmlToMarkdown(input)).toBe('## Chapter One');
        });

        it('should convert title spans with single quotes to markdown headers', () => {
            const input = "<span data-type='title'>Chapter Two</span>";
            expect(htmlToMarkdown(input)).toBe('## Chapter Two');
        });

        it('should handle title spans with additional attributes', () => {
            const input = '<span id="toc-1" data-type="title" class="heading">Introduction</span>';
            expect(htmlToMarkdown(input)).toBe('## Introduction');
        });

        it('should strip narrator links but keep text', () => {
            const input = '<a href="inr://man-1234">محمد بن أحمد</a>';
            expect(htmlToMarkdown(input)).toBe('محمد بن أحمد');
        });

        it('should handle narrator links with single quotes', () => {
            const input = "<a href='inr://man-5678'>علي بن أبي طالب</a>";
            expect(htmlToMarkdown(input)).toBe('علي بن أبي طالب');
        });

        it('should strip all remaining HTML tags', () => {
            const input = '<div><p>Hello <strong>World</strong></p></div>';
            expect(htmlToMarkdown(input)).toBe('Hello World');
        });

        it('should handle empty string', () => {
            expect(htmlToMarkdown('')).toBe('');
        });

        it('should handle text without any HTML tags', () => {
            const input = 'Plain text without any tags';
            expect(htmlToMarkdown(input)).toBe('Plain text without any tags');
        });

        it('should handle multiple title spans', () => {
            const input = '<span data-type="title">First</span>\n<span data-type="title">Second</span>';
            expect(htmlToMarkdown(input)).toBe('## First\n## Second');
        });

        it('should handle mixed content with titles and narrator links', () => {
            const input = '<span data-type="title">باب الإيمان</span>\nحَدَّثَنَا <a href="inr://man-123">أبو بكر</a>';
            expect(htmlToMarkdown(input)).toBe('## باب الإيمان\nحَدَّثَنَا أبو بكر');
        });

        it('should handle nested tags within title spans', () => {
            const input = '<span data-type="title">Title with <b>bold</b></span>';
            // The inner <b> tags remain in the title content, then get stripped by the final regex
            expect(htmlToMarkdown(input)).toBe('## Title with bold');
        });

        it('should preserve whitespace and line breaks', () => {
            const input = '<span data-type="title">Title</span>\r\nContent\r\nMore content';
            expect(htmlToMarkdown(input)).toBe('## Title\r\nContent\r\nMore content');
        });

        it('should handle spans without data-type title attribute', () => {
            const input = '<span id="link-123">Regular span</span>';
            expect(htmlToMarkdown(input)).toBe('Regular span');
        });

        it('should handle regular anchor tags (non-narrator links)', () => {
            const input = '<a href="https://example.com">External link</a>';
            expect(htmlToMarkdown(input)).toBe('External link');
        });

        it('should handle self-closing tags', () => {
            const input = 'Text<br/>More text<hr/>';
            expect(htmlToMarkdown(input)).toBe('TextMore text');
        });

        it('should handle complex real-world content', () => {
            const input = `<span data-type="title" id=toc-10>كِتَابُ الْإِيمَانِ.</span>
١ - <span data-type="title" id=toc-11>[باب مَعْرِفَةِ الإِيمَانِ]</span>
حَدَّثَنَا <a href="inr://man-3889">أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ</a>`;

            const expected = `## كِتَابُ الْإِيمَانِ.
١ - ## [باب مَعْرِفَةِ الإِيمَانِ]
حَدَّثَنَا أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ`;

            expect(htmlToMarkdown(input)).toBe(expected);
        });

        it('should strip hadeeth tags', () => {
            const input = '<hadeeth-123>Hadith content<hadeeth>';
            expect(htmlToMarkdown(input)).toBe('Hadith content');
        });

        it('should handle case-insensitive tag matching', () => {
            const input = '<SPAN data-type="title">UPPERCASE TAGS</SPAN>';
            expect(htmlToMarkdown(input)).toBe('## UPPERCASE TAGS');
        });
    });

    describe('normalizeHtml', () => {
        it('should convert numbered hadeeth tags to span with class', () => {
            const input = '<hadeeth-123>Hadith text';
            expect(normalizeHtml(input)).toBe('<span class="hadeeth">Hadith text');
        });

        it('should convert closing hadeeth tags to closing span', () => {
            const input = 'text</hadeeth>';
            expect(normalizeHtml(input)).toBe('text</span>');
        });

        it('should convert standalone hadeeth tags to closing span', () => {
            const input = 'text<hadeeth>more';
            expect(normalizeHtml(input)).toBe('text</span>more');
        });

        it('should handle complete hadeeth tag pairs', () => {
            const input = '<hadeeth-456>Hadith content</hadeeth>';
            expect(normalizeHtml(input)).toBe('<span class="hadeeth">Hadith content</span>');
        });

        it('should handle multiple hadeeth tags', () => {
            const input = '<hadeeth-1>First</hadeeth> text <hadeeth-2>Second</hadeeth>';
            expect(normalizeHtml(input)).toBe(
                '<span class="hadeeth">First</span> text <span class="hadeeth">Second</span>',
            );
        });

        it('should handle empty string', () => {
            expect(normalizeHtml('')).toBe('');
        });

        it('should preserve other HTML tags', () => {
            const input = '<span data-type="title">Title</span><hadeeth-123>Content</hadeeth>';
            expect(normalizeHtml(input)).toBe(
                '<span data-type="title">Title</span><span class="hadeeth">Content</span>',
            );
        });

        it('should handle case-insensitive matching', () => {
            const input = '<HADEETH-789>Text</HADEETH>';
            expect(normalizeHtml(input)).toBe('<span class="hadeeth">Text</span>');
        });

        it('should handle hadeeth tags with whitespace', () => {
            const input = 'text< /hadeeth >';
            expect(normalizeHtml(input)).toBe('text</span>');
        });
    });

    describe('integration', () => {
        const sanitizeAndParse = (input: string) => {
            input = removeTagsExceptSpan(input);
            input = removeArabicNumericPageMarkers(input);
            return parseContentRobust(input);
        };

        it('should merge the dangling punctuation', () => {
            const input =
                '• وَحَدَّثَنَا <a href="inr://man-3889">أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ </a>أَيْضًا، حَدَّثَنَا <a href="inr://man-6792">وَكِيعٌ </a>،  عَنْ <a href="inr://man-2779">شُعْبَةَ</a> <a href="inr://man-2472">وَسُفْيَانَ </a>،  عَنْ <a href="inr://man-1277">حَبِيبٍ (¬١) </a>،  عَنْ <a href="inr://man-6473">مَيْمُونِ بْنِ أَبِي شَبِيبٍ </a>،  عَنِ <a href="inr://man-6305">الْمُغِيرَةِ بْنِ شُعْبَةَ </a>قَالَا: قَالَ رَسُولُ اللهِ ﷺ ذَلِكَ<span id="link-١١٥٦٤"></span><hadeeth-2465> <hadeeth>.';

            const actual = sanitizeAndParse(input);
            expect(actual).toMatchObject([
                {
                    text: '• وَحَدَّثَنَا أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ أَيْضًا، حَدَّثَنَا وَكِيعٌ ،  عَنْ شُعْبَةَ وَسُفْيَانَ ،  عَنْ حَبِيبٍ (¬١) ،  عَنْ مَيْمُونِ بْنِ أَبِي شَبِيبٍ ،  عَنِ الْمُغِيرَةِ بْنِ شُعْبَةَ قَالَا: قَالَ رَسُولُ اللهِ ﷺ ذَلِكَ .',
                },
            ]);
        });

        it('should remove the turtle brackets in between but not split the lines', () => {
            const input =
                '٧٥ - (٣٣٩) وَحَدَّثَنَا <a href="inr://man-5605">مُحَمَّدُ بْنُ رَافِعٍ </a>،  حَدَّثَنَا <a href="inr://man-3447">عَبْدُ الرَّزَّاقِ </a>،  حَدَّثَنَا <a href="inr://man-6279">مَعْمَرٌ </a>،  عَنْ <a href="inr://man-6737">هَمَّامِ بْنِ مُنَبِّهٍ </a>قَالَ: هَذَا مَا حَدَّثَنَا <a href="inr://man-3320">أَبُو هُرَيْرَةَ </a>،  عَنْ مُحَمَّدٍ رَسُولِ اللهِ ﷺ، فَذَكَرَ أَحَادِيثَ مِنْهَا: وَقَالَ رَسُولُ اللهِ ﷺ: « <hadeeth-194>كَانَتْ بَنُو إِسْرَائِيلَ يَغْتَسِلُونَ عُرَاةً يَنْظُرُ بَعْضُهُمْ إِلَى سَوْأَةِ بَعْضٍ، وَكَانَ مُوسَى ﵇ يَغْتَسِلُ وَحْدَهُ، فَقَالُوا: وَاللهِ مَا يَمْنَعُ مُوسَى أَنْ يَغْتَسِلَ مَعَنَا إِلَّا أَنَّهُ آدَرُ، قَالَ: فَذَهَبَ مَرَّةً يَغْتَسِلُ فَوَضَعَ ثَوْبَهُ عَلَى حَجَرٍ، فَفَرَّ الْحَجَرُ بِثَوْبِهِ، قَالَ: فَجَمَحَ مُوسَى بِإِثْرِهِ يَقُولُ: ثَوْبِي حَجَرُ، ثَوْبِي حَجَرُ، حَتَّى نَظَرَتْ بَنُو إِسْرَائِيلَ إِلَى سَوْأَةِ مُوسَى، قَالُوا: وَاللهِ مَا بِمُوسَى\r⦗١٨٤⦘\rمِنْ بَأْسٍ، فَقَامَ الْحَجَرُ حَتَّى نُظِرَ إِلَيْهِ، قَالَ: فَأَخَذَ ثَوْبَهُ فَطَفِقَ بِالْحَجَرِ ضَرْبًا. قَالَ أَبُو هُرَيْرَةَ: وَاللهِ إِنَّهُ بِالْحَجَرِ نَدَبٌ سِتَّةٌ أَوْ سَبْعَةٌ، ضَرْبُ مُوسَى بِالْحَجَرِ <hadeeth>».';

            expect(sanitizeAndParse(input)).toEqual([
                {
                    text: '٧٥ - (٣٣٩) وَحَدَّثَنَا مُحَمَّدُ بْنُ رَافِعٍ ،  حَدَّثَنَا عَبْدُ الرَّزَّاقِ ،  حَدَّثَنَا مَعْمَرٌ ،  عَنْ هَمَّامِ بْنِ مُنَبِّهٍ قَالَ: هَذَا مَا حَدَّثَنَا أَبُو هُرَيْرَةَ ،  عَنْ مُحَمَّدٍ رَسُولِ اللهِ ﷺ، فَذَكَرَ أَحَادِيثَ مِنْهَا: وَقَالَ رَسُولُ اللهِ ﷺ: « كَانَتْ بَنُو إِسْرَائِيلَ يَغْتَسِلُونَ عُرَاةً يَنْظُرُ بَعْضُهُمْ إِلَى سَوْأَةِ بَعْضٍ، وَكَانَ مُوسَى ﵇ يَغْتَسِلُ وَحْدَهُ، فَقَالُوا: وَاللهِ مَا يَمْنَعُ مُوسَى أَنْ يَغْتَسِلَ مَعَنَا إِلَّا أَنَّهُ آدَرُ، قَالَ: فَذَهَبَ مَرَّةً يَغْتَسِلُ فَوَضَعَ ثَوْبَهُ عَلَى حَجَرٍ، فَفَرَّ الْحَجَرُ بِثَوْبِهِ، قَالَ: فَجَمَحَ مُوسَى بِإِثْرِهِ يَقُولُ: ثَوْبِي حَجَرُ، ثَوْبِي حَجَرُ، حَتَّى نَظَرَتْ بَنُو إِسْرَائِيلَ إِلَى سَوْأَةِ مُوسَى، قَالُوا: وَاللهِ مَا بِمُوسَى مِنْ بَأْسٍ، فَقَامَ الْحَجَرُ حَتَّى نُظِرَ إِلَيْهِ، قَالَ: فَأَخَذَ ثَوْبَهُ فَطَفِقَ بِالْحَجَرِ ضَرْبًا. قَالَ أَبُو هُرَيْرَةَ: وَاللهِ إِنَّهُ بِالْحَجَرِ نَدَبٌ سِتَّةٌ أَوْ سَبْعَةٌ، ضَرْبُ مُوسَى بِالْحَجَرِ ».',
                },
            ]);
        });

        it('should keep the comma and abbreviation', () => {
            const input =
                '٤٥ - (١٠٩٥) حَدَّثَنَا <a href="inr://man-7021">يَحْيَى بْنُ يَحْيَى </a>قَالَ: أَخْبَرَنَا <a href="inr://man-6709">هُشَيْمٌ </a>،  عَنْ <a href="inr://man-3479">عَبْدِ الْعَزِيزِ بْنِ صُهَيْبٍ </a>،  عَنْ <a href="inr://man-822">أَنَسٍ</a><span id="link-١٤٥٨٥"></span><hadeeth-928> <hadeeth>، (ح)';

            const actual = sanitizeAndParse(input);

            expect(actual).toEqual([
                {
                    text: '٤٥ - (١٠٩٥) حَدَّثَنَا يَحْيَى بْنُ يَحْيَى قَالَ: أَخْبَرَنَا هُشَيْمٌ ،  عَنْ عَبْدِ الْعَزِيزِ بْنِ صُهَيْبٍ ،  عَنْ أَنَسٍ ، (ح)',
                },
            ]);
        });

        it('should preserve the text before the span starts', () => {
            const input =
                "<span data-type='title' id=toc-10>كِتَابُ الْإِيمَانِ.</span>\r١ - <span data-type='title' id=toc-11>[باب مَعْرِفَةِ الإِيمَانِ وَالإِسْلَامِ وَالْقَدَرِ وَعَلَامَةِ السَّاعَةِ]</span> (¬١).";
            const actual = sanitizeAndParse(input);

            expect(actual).toEqual([
                {
                    id: '10',
                    text: 'كِتَابُ الْإِيمَانِ.',
                },
                {
                    id: '11',
                    text: '١ - [باب مَعْرِفَةِ الإِيمَانِ وَالإِسْلَامِ وَالْقَدَرِ وَعَلَامَةِ السَّاعَةِ] (¬١).',
                },
            ]);
        });

        it('should not take out additional characters', () => {
            const input =
                '١٧ - (٢٣٤) حَدَّثَنِي <a href="inr://man-5539">مُحَمَّدُ بْنُ حَاتِمِ بْنِ مَيْمُونٍ </a>،  حَدَّثَنَا <a href="inr://man-3414">عَبْدُ الرَّحْمَنِ بْنُ مَهْدِيٍّ </a>،  حَدَّثَنَا <a href="inr://man-6239">مُعَاوِيَةُ بْنُ صَالِحٍ </a>،  عَنْ <a href="inr://man-1983">رَبِيعَةَ - يَعْنِي: ابْنَ يَزِيدَ </a>-،  عَنْ <a href="inr://man-3024">أَبِي إِدْرِيسَ الْخَوْلَانِيِّ </a>،  عَنْ <a href="inr://man-4428">عُقْبَةَ بْنِ عَامِرٍ</a><span id="link-١٢١٩٨"></span><hadeeth-2563> <hadeeth>(ح)';

            const actual = sanitizeAndParse(input);
            expect(actual).toEqual([
                {
                    text: '١٧ - (٢٣٤) حَدَّثَنِي مُحَمَّدُ بْنُ حَاتِمِ بْنِ مَيْمُونٍ ،  حَدَّثَنَا عَبْدُ الرَّحْمَنِ بْنُ مَهْدِيٍّ ،  حَدَّثَنَا مُعَاوِيَةُ بْنُ صَالِحٍ ،  عَنْ رَبِيعَةَ - يَعْنِي: ابْنَ يَزِيدَ -،  عَنْ أَبِي إِدْرِيسَ الْخَوْلَانِيِّ ،  عَنْ عُقْبَةَ بْنِ عَامِرٍ (ح)',
                },
            ]);
        });

        it('should remove both of the page markers', () => {
            const input =
                '٢٦ - (٩٨٧) وَحَدَّثَنِي <a href="inr://man-5780">مُحَمَّدُ بْنُ عَبْدِ الْمَلِكِ الْأُمَوِيُّ </a>،  حَدَّثَنَا <a href="inr://man-3494">عَبْدُ الْعَزِيزِ بْنُ الْمُخْتَارِ </a>،  حَدَّثَنَا <a href="inr://man-2690">سُهَيْلُ بْنُ أَبِي صَالِحٍ </a>،  عَنْ <a href="inr://man-1906">أَبِيهِ </a>،  عَنْ <a href="inr://man-3320">أَبِي هُرَيْرَةَ </a>\r⦗٧٢⦘\rقَالَ: قَالَ رَسُولُ اللهِ ﷺ: « <hadeeth-713>مَا مِنْ صَاحِبِ كَنْزٍ لَا يُؤَدِّي زَكَاتَهُ، إِلَّا أُحْمِيَ عَلَيْهِ فِي  الْآيَةَ الْجَامِعَةَ\r⦗٧٣⦘\rالْفَاذَّةَ ﴿فَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ * وَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ <hadeeth>﴾».';

            const actual = sanitizeAndParse(input);

            expect(actual).toEqual([
                {
                    text: '٢٦ - (٩٨٧) وَحَدَّثَنِي مُحَمَّدُ بْنُ عَبْدِ الْمَلِكِ الْأُمَوِيُّ ،  حَدَّثَنَا عَبْدُ الْعَزِيزِ بْنُ الْمُخْتَارِ ،  حَدَّثَنَا سُهَيْلُ بْنُ أَبِي صَالِحٍ ،  عَنْ أَبِيهِ ،  عَنْ أَبِي هُرَيْرَةَ قَالَ: قَالَ رَسُولُ اللهِ ﷺ: « مَا مِنْ صَاحِبِ كَنْزٍ لَا يُؤَدِّي زَكَاتَهُ، إِلَّا أُحْمِيَ عَلَيْهِ فِي  الْآيَةَ الْجَامِعَةَ الْفَاذَّةَ ﴿فَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ * وَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ ﴾».',
                },
            ]);
        });
    });

    describe('stripHtmlTags', () => {
        it('should remove simple HTML tags', () => {
            expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
        });

        it('should remove self-closing tags', () => {
            expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
        });

        it('should remove tags with attributes', () => {
            expect(stripHtmlTags('<div class="test">Content</div>')).toBe('Content');
        });

        it('should remove nested tags', () => {
            expect(stripHtmlTags('<div><span>Nested</span></div>')).toBe('Nested');
        });

        it('should handle multiple tags', () => {
            expect(stripHtmlTags('<h1>Title</h1><p>Paragraph</p>')).toBe('TitleParagraph');
        });

        it('should preserve text without tags', () => {
            expect(stripHtmlTags('Plain text')).toBe('Plain text');
        });

        it('should handle empty string', () => {
            expect(stripHtmlTags('')).toBe('');
        });

        it('should handle Arabic text with HTML', () => {
            expect(stripHtmlTags('<p>بسم الله</p>')).toBe('بسم الله');
        });

        it('should remove anchor tags', () => {
            expect(stripHtmlTags('<a href="test">Link</a>')).toBe('Link');
        });
    });

    describe('normalizeLineEndings', () => {
        it('should convert Windows line endings (\\r\\n) to Unix (\\n)', () => {
            expect(normalizeLineEndings('line1\r\nline2')).toBe('line1\nline2');
        });

        it('should convert old Mac line endings (\\r) to Unix (\\n)', () => {
            expect(normalizeLineEndings('line1\rline2')).toBe('line1\nline2');
        });

        it('should preserve Unix line endings (\\n)', () => {
            expect(normalizeLineEndings('line1\nline2')).toBe('line1\nline2');
        });

        it('should handle mixed line endings', () => {
            expect(normalizeLineEndings('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
        });

        it('should handle empty string', () => {
            expect(normalizeLineEndings('')).toBe('');
        });

        it('should handle string without line endings', () => {
            expect(normalizeLineEndings('no line breaks')).toBe('no line breaks');
        });

        it('should handle multiple consecutive Windows line endings', () => {
            expect(normalizeLineEndings('a\r\n\r\nb')).toBe('a\n\nb');
        });

        it('should handle Arabic text with line endings', () => {
            expect(normalizeLineEndings('بسم الله\r\nالرحمن الرحيم')).toBe('بسم الله\nالرحمن الرحيم');
        });
    });

    describe('normalizeTitleSpans', () => {
        const html =
            '<span data-type="title" id=toc-5424>باب الميم </span><span data-type="title" id=toc-5425>من اسمه مُحَمَّد</span>';

        it('should split adjacent title spans onto separate lines', () => {
            const out = normalizeTitleSpans(html, { strategy: 'splitLines' });
            expect(out).toContain('\n');
            expect(out).toContain('toc-5424');
            expect(out).toContain('toc-5425');
        });

        it('should merge adjacent title spans into one title span', () => {
            const out = normalizeTitleSpans(html, { separator: ' — ', strategy: 'merge' });
            expect(out).toContain('data-type="title"');
            // should only have one title span after merge
            expect((out.match(/data-type="title"/g) ?? []).length).toBe(1);
            expect(out).toContain('باب الميم');
            expect(out).toContain('من اسمه مُحَمَّد');
            expect(out).toContain('—');
        });

        it('should convert subsequent adjacent title spans to subtitle for hierarchy', () => {
            const out = normalizeTitleSpans(html, { strategy: 'hierarchy' });
            expect((out.match(/data-type="title"/g) ?? []).length).toBe(1);
            expect((out.match(/data-type="subtitle"/g) ?? []).length).toBe(1);
            expect(out).toContain('\n');
        });
    });

    describe('moveContentAfterLineBreakIntoSpan', () => {
        it('should move content after carriage return into the title span', () => {
            const input = '\r١ - <span data-type="title">الباب الأول</span>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('\r<span data-type="title">١ - الباب الأول</span>');
        });

        it('should move content at the start of the string into the title span', () => {
            const input = 'مقدمة <span data-type="title">العنوان</span>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('<span data-type="title">مقدمة العنوان</span>');
        });

        it('should handle multiple title spans on different lines', () => {
            const input =
                '\rأولاً <span data-type="title">الفصل الأول</span>\rثانياً <span data-type="title">الفصل الثاني</span>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toContain('<span data-type="title">أولاً الفصل الأول</span>');
            expect(result).toContain('<span data-type="title">ثانياً الفصل الثاني</span>');
        });

        it('should handle title spans with single quotes', () => {
            const input = "\r١ - <span data-type='title'>الباب</span>";
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('\r<span data-type="title">١ - الباب</span>');
        });

        it('should handle title spans with additional attributes', () => {
            const input = '\r١ - <span id="toc-1" data-type="title" class="heading">الباب</span>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('\r<span data-type="title">١ - الباب</span>');
        });

        it('should not modify content without title spans', () => {
            const input = '\rSome regular content without spans';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe(input);
        });

        it('should handle empty string', () => {
            expect(moveContentAfterLineBreakIntoSpan('')).toBe('');
        });

        it('should handle title span with no preceding content', () => {
            const input = '\r<span data-type="title">العنوان</span>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('\r<span data-type="title">العنوان</span>');
        });

        it('should handle case-insensitive matching', () => {
            const input = '\r١ - <SPAN DATA-TYPE="title">الباب</SPAN>';
            const result = moveContentAfterLineBreakIntoSpan(input);
            expect(result).toBe('\r<span data-type="title">١ - الباب</SPAN>');
        });
    });

    describe('convertContentToMarkdown', () => {
        it('should convert simple title span to markdown header', () => {
            const input = '<span data-type="title">Chapter One</span>';
            expect(convertContentToMarkdown(input)).toBe('## Chapter One');
        });

        it('should split adjacent title spans onto separate lines', () => {
            const input = '<span data-type="title">First</span><span data-type="title">Second</span>';
            const result = convertContentToMarkdown(input);
            expect(result).toBe('## First\n## Second');
        });

        it('should move pre-title content into the span before converting', () => {
            const input = '\r١ - <span data-type="title">الباب الأول</span>';
            const result = convertContentToMarkdown(input);
            expect(result).toBe('\n## ١ - الباب الأول');
        });

        it('should handle complex content with multiple transformations', () => {
            const input =
                '<span data-type="title">كتاب الإيمان</span><span data-type="title">باب معرفة الإيمان</span>\rحَدَّثَنَا <a href="inr://man-123">أبو بكر</a>';
            const result = convertContentToMarkdown(input);
            expect(result).toContain('## كتاب الإيمان');
            expect(result).toContain('## باب معرفة الإيمان');
            expect(result).toContain('أبو بكر');
            expect(result).not.toContain('<a');
        });

        it('should preserve line breaks in content', () => {
            const input = '<span data-type="title">Title</span>\r\nContent line 1\r\nContent line 2';
            const result = convertContentToMarkdown(input);
            expect(result).toBe('## Title\nContent line 1\nContent line 2');
        });

        it('should handle empty string', () => {
            expect(convertContentToMarkdown('')).toBe('');
        });

        it('should strip other HTML tags', () => {
            const input = '<span data-type="title">Title</span><p>Paragraph</p>';
            const result = convertContentToMarkdown(input);
            expect(result).toBe('## TitleParagraph');
        });

        it('should allow custom options for title span normalization', () => {
            const input = '<span data-type="title">First</span><span data-type="title">Second</span>';
            const result = convertContentToMarkdown(input, { separator: ' - ', strategy: 'merge' });
            expect(result).toBe('## First - Second');
        });

        it('should handle real-world Shamela content', () => {
            const input = `<span data-type='title' id=toc-10>كِتَابُ الْإِيمَانِ.</span>\r١ - <span data-type='title' id=toc-11>[باب مَعْرِفَةِ الإِيمَانِ]</span>`;
            const result = convertContentToMarkdown(input);
            expect(result).toContain('## كِتَابُ الْإِيمَانِ.');
            expect(result).toContain('## ١ - [باب مَعْرِفَةِ الإِيمَانِ]');
        });

        it('should handle subsequent spans', () => {
            const input =
                '<span data-type="title" id=toc-931>باب الجيم</span>\r<span data-type="title" id=toc-932>من اسمه جأَبَان وجابر</span>\r٨٦٤ - س.\rعَن: عَبْد اللَّهِ\rوعَنه: سالم بْن أَبي الجعد';
            const result = convertContentToMarkdown(input);

            expect(result).toBe(
                ['## باب الجيم', '## من اسمه جأَبَان وجابر', '٨٦٤ - س.', 'عَن: عَبْد اللَّهِ', 'وعَنه: سالم بْن أَبي الجعد'].join(
                    '\n',
                ),
            );
        });

        it('should preserve double carriage returns as blank lines', () => {
            const input =
                "<span data-type='title' id=toc-47>[فَضْلُ عَبْدِ اللهِ بْنِ مَسْعُودٍ ﵁ </span>-] (¬١)\r١٣٧ - حَدَّثَنَا\r\r<span data-type='title' id=toc-48>فَضَائِلُ الْعَبَّاسِ</span>";
            const result = convertContentToMarkdown(input);

            expect(result).toBe(
                ['## [فَضْلُ عَبْدِ اللهِ بْنِ مَسْعُودٍ ﵁ -] (¬١)', '١٣٧ - حَدَّثَنَا', '', '## فَضَائِلُ الْعَبَّاسِ'].join('\n'),
            );
        });

        it('should handle Windows line endings (\\r\\n)', () => {
            const input = '<span data-type="title">Title</span>\r\nLine 1\r\nLine 2';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## Title\nLine 1\nLine 2');
        });

        it('should handle unusual \\n\\r sequence', () => {
            const input = '<span data-type="title">Title</span>\n\rLine 1\n\rLine 2';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## Title\n\nLine 1\n\nLine 2');
        });

        it('should handle mixed line endings', () => {
            const input = '<span data-type="title">Title</span>\rLine 1\r\nLine 2\nLine 3';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## Title\nLine 1\nLine 2\nLine 3');
        });

        it('should handle multiple non-consecutive spans with various line endings', () => {
            const input =
                "<span data-type='title'>First</span>-]\r١٣٧ content\r\r<span data-type='title'>Second</span>-]\r\n١٤٠ more\n\n<span data-type='title'>Third</span>";
            const result = convertContentToMarkdown(input);

            expect(result).toBe(
                ['## First-]', '١٣٧ content', '', '## Second-]', '١٤٠ more', '', '## Third'].join('\n'),
            );
        });

        it('should handle consecutive spans with \\r\\n between them', () => {
            const input = '<span data-type="title">First</span>\r\n<span data-type="title">Second</span>\r\nContent';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## First\n## Second\nContent');
        });

        it('should handle triple line breaks', () => {
            const input = '<span data-type="title">Title</span>\r\r\rContent';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## Title\n\n\nContent');
        });

        it('should handle nested title spans', () => {
            const input =
                '<span data-type="title" id=toc-66><span data-type="title" id=toc-67>ذكر من اسمه فضيل</span></span>\r٥٤٢٦- فضيل';
            const result = convertContentToMarkdown(input);

            expect(result).toContain('## ذكر من اسمه فضيل');
            expect(result).toContain('٥٤٢٦- فضيل');
        });

        it('should merge trailing punctuation after title span', () => {
            const input = `<span data-type='title' id=toc-5004>سَلْمَى بِنْتُ عُمَيْسِ </span>"`;
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## سَلْمَى بِنْتُ عُمَيْسِ "');
        });

        it('should keep trailing period with title', () => {
            const input = '<span data-type="title" id=toc-5>٤ - أبان بن حاتم الأملوكي</span>.\rروى عن عمر';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## ٤ - أبان بن حاتم الأملوكي.\nروى عن عمر');
        });

        it('should keep trailing dash with title', () => {
            const input =
                "<span data-type='title' id=toc-285>٢٥ - [بَابُ] الصَّلَاةِ عَلَى النَّبِيِّ ﷺ </span>-\r٩٠٣ - (صحيح) حَدَّثَنَاةُ";
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## ٢٥ - [بَابُ] الصَّلَاةِ عَلَى النَّبِيِّ ﷺ -\n٩٠٣ - (صحيح) حَدَّثَنَاةُ');
        });

        it('should strip narrator links and keep text', () => {
            const input =
                '<span data-type="title">باب</span>\rحَدَّثَنَا <a href="inr://man-3889">أَبُو بَكْرِ</a> و<a href="inr://man-6792">وَكِيعٌ</a>';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## باب\nحَدَّثَنَا أَبُو بَكْرِ ووَكِيعٌ');
        });

        it('should strip hadeeth tags in content', () => {
            const input = '<span data-type="title">باب الحديث</span>\r<hadeeth-123>حديث شريف<hadeeth>';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## باب الحديث\nحديث شريف');
        });

        it('should handle spans with content before/after being closed by another span', () => {
            const input = `<span data-type="title" id=toc-179>فِي تَفْسِيرِ قَوْلِهِ: {وَلَدَيْنَا مَزِيدٌ} [</span>ق: ٣٥]`;
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## فِي تَفْسِيرِ قَوْلِهِ: {وَلَدَيْنَا مَزِيدٌ} [ق: ٣٥]');
        });

        it('should handle complex real-world content with multiple features', () => {
            const input = `<span data-type='title' id=toc-10>كِتَابُ الْإِيمَانِ.</span>
١ - <span data-type='title' id=toc-11>[باب مَعْرِفَةِ الإِيمَانِ]</span> (¬١).
حَدَّثَنَا <a href="inr://man-3889">أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ</a>`;
            const result = convertContentToMarkdown(input);

            expect(result).toContain('## كِتَابُ الْإِيمَانِ.');
            expect(result).toContain('## ١ - [باب مَعْرِفَةِ الإِيمَانِ] (¬١).');
            expect(result).toContain('أَبُو بَكْرِ بْنُ أَبِي شَيْبَةَ');
            expect(result).not.toContain('<a');
            expect(result).not.toContain('</a>');
        });

        it('should handle uppercase HTML tags', () => {
            const input = '<SPAN data-type="title">UPPERCASE TAGS</SPAN>\rContent';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## UPPERCASE TAGS\nContent');
        });

        it('should handle self-closing tags in content', () => {
            const input = '<span data-type="title">Title</span>\rText<br/>More<hr/>End';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## Title\nTextMoreEnd');
        });

        it('should handle empty span with id only', () => {
            const input = 'Content<span id="link-123"></span>More';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('ContentMore');
        });

        it('should handle content with Quranic brackets', () => {
            const input = '<span data-type="title">باب</span>\r﴿فَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ﴾';
            const result = convertContentToMarkdown(input);

            expect(result).toBe('## باب\n﴿فَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ﴾');
        });
    });
});
