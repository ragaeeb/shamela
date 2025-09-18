import { describe, expect, it } from 'bun:test';

import { parseContentRobust } from './content';

describe('content', () => {
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
});
