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
});
