import { describe, expect, it } from 'bun:test';

import {
    parseContentRobust,
    removeArabicNumericPageMarkers,
    removeTagsExceptSpan,
    sanitizePageContent,
    splitPageBodyFromFooter,
} from './content';
import { DEFAULT_SANITIZATION_RULES } from './utils/constants';

describe('content', () => {
    describe('sanitizePageContent', () => {
        it('should remove 舄 character', () => {
            const input = 'Hello 舄 world 舄 test';
            const expected = 'Hello  world  test';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should remove malformed img tags', () => {
            const input = "Text <img src='test'>> more text <img alt='test'>>";
            const expected = 'Text  more text ';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should replace ﵌ with Arabic blessing', () => {
            const input = 'Prophet Muhammad ﵌ was born';
            const expected = 'Prophet Muhammad صلى الله عليه وآله وسلم was born';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should apply all default rules in combination', () => {
            const input = "Test 舄 content <img src='test'>> with ﵌ multiple rules";
            const expected = 'Test  content  with صلى الله عليه وآله وسلم multiple rules';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should handle multiple occurrences of same pattern', () => {
            const input = '舄舄舄 multiple 舄 occurrences 舄';
            const expected = ' multiple  occurrences ';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(sanitizePageContent('')).toBe('');
        });

        it('should handle text with no matches', () => {
            const input = 'Normal text with no special characters';
            expect(sanitizePageContent(input)).toBe(input);
        });

        it('should handle text with only whitespace', () => {
            const input = '   \n\t  ';
            expect(sanitizePageContent(input)).toBe(input);
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
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });

        it('should override default rules with custom ones', () => {
            const customRules = {
                ...DEFAULT_SANITIZATION_RULES,
                舄: '[REMOVED]', // Override default removal with replacement
            };
            const input = 'Test 舄 override';
            const expected = 'Test [REMOVED] override';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });

        it('should extend default rules with additional ones', () => {
            const customRules = {
                ...DEFAULT_SANITIZATION_RULES,
                extra: 'EXTRA',
            };
            const input = 'Test 舄 extra ﵌ content';
            const expected = 'Test  EXTRA صلى الله عليه وآله وسلم content';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });

        it('should handle empty custom rules object', () => {
            const input = 'Test 舄 content ﵌';
            expect(sanitizePageContent(input, {})).toBe(input); // No rules applied
        });

        it('should handle complex regex patterns in custom rules', () => {
            const customRules = {
                '[0-9]+': 'X', // Replace numbers
                '\\b\\w{4}\\b': '[FOUR]', // Replace 4-letter words
            };
            const input = 'This test has 123 and some text';
            const expected = '[FOUR] [FOUR] has X and [FOUR] [FOUR]';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });

        it('should handle special regex characters in patterns', () => {
            const customRules = {
                '\\[.*?\\]': '(brackets)', // Replace content in brackets
                '\\$\\d+': '[PRICE]', // Match $123 format
            };
            const input = 'Price $50 and [some text] here';
            const expected = 'Price [PRICE] and (brackets) here';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });

        it('should handle rules with empty replacement strings', () => {
            const customRules = {
                remove: '',
                replace: 'REPLACED',
            };
            const input = 'remove this and replace that';
            const expected = ' this and REPLACED that';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
        });
    });

    describe('performance and edge cases', () => {
        it('should handle very long strings', () => {
            const input = `${'a'.repeat(10000)}舄${'b'.repeat(10000)}`;
            const expected = `${'a'.repeat(10000)}${'b'.repeat(10000)}`;
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should handle unicode characters correctly', () => {
            const input = 'Test 舄 emoji 😀 and ﵌ unicode';
            const expected = 'Test  emoji 😀 and صلى الله عليه وآله وسلم unicode';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should handle newlines and special whitespace', () => {
            const input = 'Line1\n舄\nLine2\t﵌\rLine3';
            const expected = 'Line1\n\nLine2\tصلى الله عليه وآله وسلم\rLine3';
            expect(sanitizePageContent(input)).toBe(expected);
        });

        it('should maintain object reference equality for default rules', () => {
            // This tests the performance optimization path
            const input = 'test 舄 content';
            const result1 = sanitizePageContent(input);
            const result2 = sanitizePageContent(input, DEFAULT_SANITIZATION_RULES);
            expect(result1).toBe(result2);
            expect(result1).toBe('test  content');
        });

        it("should handle rules that don't match anything", () => {
            const customRules = {
                another: 'value',
                nonexistent: 'replacement',
            };
            const input = 'This text has no matches';
            expect(sanitizePageContent(input, customRules)).toBe(input);
        });

        it('should handle overlapping patterns correctly', () => {
            const customRules = {
                ab: 'X',
                abc: 'Y',
            };
            const input = 'abc def';
            // Since 'ab' is processed first (object iteration order), 'abc' becomes 'Xc'
            // Then 'abc' pattern won't match 'Xc', so result is 'Xc def'
            const result = sanitizePageContent(input, customRules);
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
            expect(() => sanitizePageContent(input, customRules)).toThrow();
        });

        it('should handle rules with literal string patterns', () => {
            const customRules = {
                'hello world': 'hi earth',
            };
            const input = 'Say hello world to everyone';
            const expected = 'Say hi earth to everyone';
            expect(sanitizePageContent(input, customRules)).toBe(expected);
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

        it('removeTagsExceptSpan handles nested tags', () => {
            const input = '<a href="#">خارج <span>داخل</span></a>';
            expect(removeTagsExceptSpan(input)).toBe('خارج <span>داخل</span>');
        });
    });
});
